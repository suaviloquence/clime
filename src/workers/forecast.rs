use std::time::Duration;

use anyhow::Context;
use futures_util::future::BoxFuture;
use openweather_api::{Client, Coordinates};

use crate::{db::Pool, models::forecast::Forecast};

use super::Update;

#[derive(Debug, Clone)]
pub struct ForecastUpdater {
	pub con: Pool,
	pub client: Client,
}

impl Update for ForecastUpdater {
	const INTERVAL_LENGTH: Duration = Duration::from_secs(6 * 60 * 60);

	type Future = BoxFuture<'static, anyhow::Result<()>>;

	fn update(self) -> Self::Future {
		Box::pin(self.run())
	}
}

impl ForecastUpdater {
	async fn run(self) -> anyhow::Result<()> {
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
		.context("Error getting universities to fetch from database.")?;

		let mut trans = self
			.con
			.begin()
			.await
			.context("Error beginning transaction")?;

		for row in universities {
			let coords = Coordinates {
				latitude: row.latitude,
				longitude: row.longitude,
			};

			let forecasts = Forecast::fetch(self.client.clone(), row.university_id, &coords, 40)
				.await
				.with_context(|| {
					format!(
						"Error fetching from openweather API (university {}: ({:.3}, {:.3})",
						row.university_id, row.latitude, row.longitude
					)
				})?;

			for forecast in forecasts {
				forecast.put(&mut trans).await.with_context(|| {
					format!("Error inserting forecast {:?} into database", forecast)
				})?;
			}
			log::info!("Updated university {}", row.university_id);
		}

		trans
			.commit()
			.await
			.context("Error committing transaction")?;

		log::info!("Successfully committed transaction.");
		Ok(())
	}
}
