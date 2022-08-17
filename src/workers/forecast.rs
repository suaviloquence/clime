use std::time::Duration;

use actix::{Actor, AsyncContext, Context, WrapFuture};
use anyhow::Context as _;
use chrono::Utc;
use openweather::{Client, Coordinates};

use crate::{db::Pool, models::forecast::Forecast};

const INTERVAL_LENGTH: u64 = 6 * 60 * 60;

pub struct ForecastUpdater {
	pub con: Pool,
	pub client: Client,
}

impl Actor for ForecastUpdater {
	type Context = Context<Self>;

	fn started(&mut self, ctx: &mut Self::Context) {
		log::info!("Waiting to run until {:?}", next_interval());
		ctx.run_later(next_interval(), move |_, ctx| {
			log::info!("Starting interval");
			ctx.run_interval(Duration::from_secs(INTERVAL_LENGTH), Self::update);
		});
	}
}

impl ForecastUpdater {
	fn update(&mut self, ctx: &mut Context<Self>) {
		let con = self.con.clone();
		let client = self.client.clone();
		ctx.spawn(Self::run(con, client).into_actor(self));
	}

	pub async fn run(con: Pool, client: Client) {
		log::info!("Getting universities..");
		let universities = sqlx::query!(
			r#"SELECT DISTINCT
					get_weather.university_id,
					universities.longitude,
					universities.latitude
				FROM get_weather INNER JOIN universities
					ON get_weather.university_id = universities.id"#
		)
		.fetch_all(&con)
		.await
		.context("Error getting universities to fetch from database.")
		.unwrap();

		let mut trans = con
			.begin()
			.await
			.context("Error beginning transaction")
			.unwrap();

		for row in universities {
			let coords = Coordinates {
				latitude: row.latitude,
				longitude: row.longitude,
			};

			let forecasts = Forecast::fetch(client.clone(), row.university_id, &coords, 40)
				.await
				.with_context(|| {
					format!(
						"Error fetching from openweather API (university {}: ({:.3}, {:.3})",
						row.university_id, row.latitude, row.longitude
					)
				})
				.unwrap();

			for forecast in forecasts {
				forecast
					.put(&mut trans)
					.await
					.with_context(|| {
						format!("Error inserting forecast {:?} into database", forecast)
					})
					.unwrap();
			}
			log::info!("Updated university {}", row.university_id);
		}

		trans
			.commit()
			.await
			.context("Error committing transaction")
			.unwrap();

		log::info!("Successfully committed transaction.");
	}
}

fn next_interval() -> Duration {
	let now = Utc::now();
	Duration::from_secs(INTERVAL_LENGTH - now.timestamp() as u64 % INTERVAL_LENGTH)
}
