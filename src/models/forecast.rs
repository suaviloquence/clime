use chrono::{naive::serde::ts_milliseconds, NaiveDateTime, Utc};
use chrono_tz::Tz;
use openweather::{Client, Coordinates};
use serde::Serialize;

use crate::db::Executor;

#[derive(Debug, Serialize)]
pub struct Forecast {
	pub university_id: i64,
	#[serde(with = "ts_milliseconds")]
	pub time: NaiveDateTime,
	#[serde(with = "ts_milliseconds")]
	pub fetched_at: NaiveDateTime,
	pub temperature: f64,
	pub feels_like: f64,
	pub weather_id: i64,
	pub weather_description: String,
	pub humidity: f64,
	pub pressure: f64,
	pub wind_speed: f64,
	pub precipitation_chance: f64,
}

impl Forecast {
	/// max limit = 40 (8 sets of 3-hour periods per day × 5 days)
	pub async fn fetch(
		client: Client,
		university_id: i64,
		coords: &Coordinates,
		limit: u16,
	) -> openweather::Result<Vec<Self>> {
		let fetched_at = Utc::now().naive_utc();

		client.forecast(limit, coords).await.map(|resp| {
			resp.list
				.into_iter()
				.map(|f| {
					// TODO: verify that it is guaranteed that weather has at least 1 element
					let main_weather = f.weather.into_iter().next().unwrap();
					Self {
						university_id,
						time: f.time.naive_utc(),
						fetched_at,
						temperature: f.main.temp.0,
						weather_id: main_weather.id as u32 as i64,
						weather_description: main_weather.description,
						feels_like: f.main.feels_like.0,
						humidity: f.main.humidity as f64,
						pressure: f.main.pressure,
						wind_speed: f.wind.speed.0,
						precipitation_chance: f.precipitation_probability as f64,
					}
				})
				.collect()
		})
	}

	pub async fn put(&self, con: impl Executor<'_>) -> sqlx::Result<()> {
		sqlx::query!(
			"INSERT INTO forecasts (
				university_id,
				time,
				fetched_at,
				temperature,
				feels_like,
				weather_id,
				weather_description,
				humidity,
				pressure,
				wind_speed,
				precipitation_chance
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
				ON CONFLICT(university_id, time) DO UPDATE SET (
					fetched_at,
					temperature,
					feels_like,
					weather_id,
					weather_description,
					humidity,
					pressure,
					wind_speed,
					precipitation_chance
				) = (
					excluded.fetched_at,
					excluded.temperature,
					excluded.feels_like,
					excluded.weather_id,
					excluded.weather_description,
					excluded.humidity,
					excluded.pressure,
					excluded.wind_speed,
					excluded.precipitation_chance
				)
			",
			self.university_id,
			self.time,
			self.fetched_at,
			self.temperature,
			self.feels_like,
			self.weather_id,
			self.weather_description,
			self.humidity,
			self.pressure,
			self.wind_speed,
			self.precipitation_chance,
		)
		.execute(con)
		.await
		.map(|_| ())
	}

	pub async fn get_most_recent(
		con: impl Executor<'_>,
		university_id: i64,
		limit: u32,
	) -> sqlx::Result<Vec<Self>> {
		sqlx::query_as!(
			Self,
			"SELECT * FROM forecasts
			WHERE university_id = $1
			ORDER BY time DESC
			LIMIT $2",
			university_id,
			limit
		)
		.fetch_all(con)
		.await
	}

	pub async fn get_all_since(
		con: impl Executor<'_> + Clone,
		university_id: i64,
	) -> sqlx::Result<Option<Vec<Self>>> {
		let tz = match sqlx::query!(
			"SELECT timezone FROM universities WHERE id = $1",
			university_id
		)
		.fetch_optional(con.clone())
		.await?
		{
			Some(row) => row.timezone,
			None => return Ok(None),
		};

		// TODO this shouldnt happen-- should we add error to ret type?
		let tz = tz
			.parse::<Tz>()
			.map_err(|_| format!("Could not load {} as timezone", tz))
			.unwrap();

		let not_before = Utc::now()
			.with_timezone(&tz)
			.date()
			.and_hms(0, 0, 0)
			.naive_utc();

		// worst-case scenario: 11:59 pm => 40 max + 8/day = 48
		const LIMIT: u32 = 200;

		Self::get_most_recent(con, university_id, LIMIT)
			.await
			.map(|forecasts| {
				Some(
					forecasts
						.into_iter()
						.filter(|forecast| forecast.time >= not_before)
						.rev()
						.collect(),
				)
			})
	}
}
