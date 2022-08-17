#[macro_use]
extern crate lazy_static;

use std::env;

use actix_files::{Files, NamedFile};
use actix_web::{web, App, HttpServer};
use anyhow::Context;
use jsonwebtoken::{DecodingKey, EncodingKey};
use openweather::Client;
use workers::{forecast::ForecastUpdater, weather::WeatherUpdater, Updater};

mod api;
pub mod db;
pub mod models;
mod workers;

fn get_env(name: &str) -> anyhow::Result<String> {
	env::var(name).with_context(|| format!("Error loading environment variable {}.", name))
}

lazy_static! {
	// argon2::Config borrows this, and it needs to be 'static
	static ref PASSWORD_SECRET: String = get_env("PASSWORD_SECRET").unwrap();
}

#[actix_web::main]
async fn main() -> anyhow::Result<()> {
	dotenv::dotenv().context("Error loading .env file.")?;
	env_logger::init();

	let con = db::create(&get_env("DATABASE_URL")?)
		.await
		.context("Error connecting to database")?;

	let jwt_secret = get_env("JWT_SECRET")?;
	let encoder = EncodingKey::from_secret(jwt_secret.as_bytes());
	let decoder = DecodingKey::from_secret(jwt_secret.as_bytes());

	let client = Client::new(get_env("OPENWEATHER_API_KEY")?, None, None);

	let argon2_config = argon2::Config {
		secret: PASSWORD_SECRET.as_bytes(),
		..Default::default()
	};

	Updater::start(WeatherUpdater {
		con: con.clone(),
		client: client.clone(),
	});

	Updater::start(ForecastUpdater {
		con: con.clone(),
		client: client.clone(),
	});

	sqlx::migrate!("./migrations")
		.run(&con)
		.await
		.context("Error running database migrations.")?;

	HttpServer::new(move || {
		App::new()
			.app_data(web::Data::new(con.clone()))
			.app_data(web::Data::new(client.clone()))
			.app_data(web::Data::new(encoder.clone()))
			.app_data(web::Data::new(decoder.clone()))
			.app_data(web::Data::new(argon2_config.clone()))
			.service(web::scope("api").configure(api::configure))
			.service(Files::new("/static", "./static"))
			.default_service(web::to(|| NamedFile::open_async("./static/index.html")))
	})
	.bind((
		get_env("IP")?,
		get_env("PORT")?
			.parse::<u16>()
			.context("PORT is not a u16")?,
	))?
	.workers(2)
	.run()
	.await?;

	Ok(())
}
