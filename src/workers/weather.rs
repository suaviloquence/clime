use std::time::Duration;

use actix::{Actor, AsyncContext, Context, WrapFuture};
use anyhow::Context as _;
use chrono::Utc;
use openweather::{Client, Coordinates};

use crate::{db::Pool, models::weather::Weather};

const INTERVAL_LENGTH: u64 = 3600;

pub struct WeatherUpdater {
	pub con: Pool,
	pub client: Client,
}

impl Actor for WeatherUpdater {
	type Context = Context<Self>;

	fn started(&mut self, ctx: &mut Self::Context) {
		log::info!("Waiting to run until {:?}", next_interval());
		ctx.run_later(next_interval(), move |_, ctx| {
			log::info!("Starting interval");
			ctx.run_interval(Duration::from_secs(INTERVAL_LENGTH), Self::update);
		});
	}
}

impl WeatherUpdater {
	fn update(&mut self, ctx: &mut Context<Self>) {
		let con = self.con.clone();
		let client = self.client.clone();
		ctx.spawn(
			async move {
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

				for row in universities {
					let weather = Weather::fetch(
						&client,
						row.university_id,
						&Coordinates {
							latitude: row.latitude,
							longitude: row.longitude,
						},
					)
					.await
					.with_context(|| {
						format!(
							"Error fetching from openweather API (university {}: ({:.3}, {:.3})",
							row.university_id, row.latitude, row.longitude
						)
					})
					.unwrap();

					weather
						.put(&con)
						.await
						.with_context(|| {
							format!("Error inserting weather {:?} into database", weather)
						})
						.unwrap();

					log::info!("Updated university {}", row.university_id);
				}
			}
			.into_actor(self),
		);
	}
}

fn next_interval() -> Duration {
	let now = Utc::now();
	Duration::from_secs(now.timestamp() as u64 % INTERVAL_LENGTH)
}
