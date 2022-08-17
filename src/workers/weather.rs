use std::time::Duration;

use anyhow::Context as _;
use openweather::{Client, Coordinates};

use crate::{db::Pool, models::weather::Weather};

use super::Update;

#[derive(Debug, Clone)]
pub struct WeatherUpdater {
	pub con: Pool,
	pub client: Client,
}

impl Update for WeatherUpdater {
	const INTERVAL_LENGTH: Duration = Duration::from_secs(60 * 60);

	type Future = futures_util::future::BoxFuture<'static, ()>;

	fn update(self) -> Self::Future {
		Box::pin(async move {
			log::info!("Getting universities..");
			let universities = sqlx::query!(
				r#"SELECT DISTINCT
								get_weather.university_id,
								universities.longitude,
								universities.latitude
							FROM get_weather INNER JOIN universities
								ON get_weather.university_id = universities.id"#
			)
			.fetch_all(&self.con)
			.await
			.context("Error getting universities to fetch from database.")
			.unwrap();

			let mut trans = self
				.con
				.begin()
				.await
				.context("Error beginning transaction.")
				.unwrap();

			for row in universities {
				let weather = Weather::fetch(
					&self.client,
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
					.put(&mut trans)
					.await
					.with_context(|| format!("Error inserting weather {:?} into database", weather))
					.unwrap();

				log::info!("Updated university {}", row.university_id);
			}

			trans
				.commit()
				.await
				.context("Error committing transaction")
				.unwrap();
			log::info!("Committed transaction");
		})
	}
}
