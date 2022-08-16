use crate::db::{Executor, Pool};
use chrono::{naive::serde::ts_milliseconds, NaiveDateTime, Utc};
use openweather::{Client, Coordinates};
use serde::Serialize;

use super::university::University;

#[derive(Debug, Serialize)]
pub struct Weather {
	pub university_id: i64,
	#[serde(with = "ts_milliseconds")]
	pub time: NaiveDateTime,
	pub temperature: f64,
	pub feels_like: f64,
	pub weather_type: i64,
	pub weather_description: String,
	pub humidity: f64,
	pub pressure: f64,
	pub wind_speed: f64,
	pub cloudiness: f64,
}

impl Weather {
	pub async fn fetch(
		client: &Client,
		university_id: i64,
		coords: &Coordinates,
	) -> openweather::Result<Self> {
		client.weather_at(coords).await.map(|weather| {
			// TODO: i think it's guaranteed that len >= 1, but not sure
			let main_weather = weather.weather.into_iter().next().unwrap();
			Self {
				university_id,
				time: Utc::now().naive_utc(),
				temperature: weather.main.temp.0,
				feels_like: weather.main.feels_like.0,
				// TODO: check if weather.len() > 0?
				weather_type: main_weather.id as i64,
				weather_description: main_weather.description,
				humidity: weather.main.humidity as f64,
				pressure: weather.main.pressure,
				wind_speed: weather.wind.speed.0,
				cloudiness: weather.clouds.cloudiness as f64,
			}
		})
	}

	pub async fn fetch_by_university(
		client: &Client,
		university: &University,
	) -> openweather::Result<Self> {
		Self::fetch(
			client,
			university.id,
			&Coordinates {
				longitude: university.longitude,
				latitude: university.latitude,
			},
		)
		.await
	}

	pub async fn get_all(con: &Pool, university_id: i64) -> sqlx::Result<Vec<Self>> {
		sqlx::query_as!(
			Self,
			"SELECT * FROM weather WHERE university_id = $1",
			university_id
		)
		.fetch_all(con)
		.await
	}

	pub async fn get_most_recent(
		con: &Pool,
		university_id: i64,
		limit: u32,
	) -> sqlx::Result<Vec<Self>> {
		sqlx::query_as!(
			Self,
			"SELECT * FROM weather
			WHERE university_id = $1
			ORDER BY time DESC
			LIMIT $2",
			university_id,
			limit
		)
		.fetch_all(con)
		.await
	}

	pub async fn put(&self, con: impl Executor<'_>) -> sqlx::Result<()> {
		sqlx::query!(
			"INSERT INTO weather (
				university_id,
				time,
				temperature,
				feels_like,
				weather_type,
				weather_description,
				humidity,
				pressure,
				wind_speed,
				cloudiness
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
			self.university_id,
			self.time,
			self.temperature,
			self.feels_like,
			self.weather_type,
			self.weather_description,
			self.humidity,
			self.pressure,
			self.wind_speed,
			self.cloudiness
		)
		.execute(con)
		.await
		.map(|_| ())
	}
}
