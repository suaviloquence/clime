use chrono::{DateTime, Utc};
use reqwest::header::HeaderValue;
use serde::Deserialize;

use crate::{Client, NwsStation, QuantitativeValue, API_ENDPOINT};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Units {
	Us,
	Si,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TemperatureTrend {
	Rising,
	Falling,
}

#[derive(Debug, Deserialize)]
pub enum WindDirection {
	N,
	NNE,
	NE,
	ENE,
	E,
	ESE,
	SE,
	SSE,
	S,
	SSW,
	SW,
	WSW,
	W,
	WNW,
	NW,
	NNW,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Forecast {
	pub number: u32,
	pub name: Option<String>,
	pub start_time: DateTime<Utc>,
	pub end_time: DateTime<Utc>,
	pub is_daytime: bool,
	pub temperature: QuantitativeValue<f64>,
	pub temperature_trend: Option<TemperatureTrend>,
	pub wind_speed: QuantitativeValue<f64>,
	pub wind_gust: Option<QuantitativeValue<f64>>,
	pub wind_direction: WindDirection,
	pub short_forecast: String,
	pub detailed_forecast: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForecastResponse {
	// TODO:
	// @context: JsonLdContext
	// geometry: Option<String: WKT>
	pub units: Units,
	pub forecast_generator: String,
	pub generated_at: DateTime<Utc>,
	pub update_time: DateTime<Utc>,
	// TODO: type is ISO8601Interval
	pub valid_times: String,
	pub elevation: QuantitativeValue<f64>,
	pub periods: Box<[Forecast]>,
}

const FORECAST_FEATURE_FLAGS: HeaderValue =
	HeaderValue::from_static("forecast_temperature_qv,forecast_wind_speed_qv");

impl Client {
	#[inline]
	pub async fn forecast_hourly_from_coordinates(
		&self,
		latitude: f64,
		longitude: f64,
	) -> crate::Result<ForecastResponse> {
		self.forecast_from_url(self.points(latitude, longitude).await?.forecast_hourly)
			.await
	}

	#[inline]
	pub async fn forecast_from_coordinates(
		&self,
		latitude: f64,
		longitude: f64,
	) -> crate::Result<ForecastResponse> {
		self.forecast_from_url(self.points(latitude, longitude).await?.forecast)
			.await
	}

	#[inline]
	pub async fn forecast_from_url(&self, url: impl AsRef<str>) -> crate::Result<ForecastResponse> {
		self.get_ld(url.as_ref(), Some(FORECAST_FEATURE_FLAGS))
			.await
	}

	#[inline]
	pub async fn forecast_hourly_from_grid(
		&self,
		wfo: NwsStation,
		x: u32,
		y: u32,
	) -> crate::Result<ForecastResponse> {
		self.forecast_from_url(format!(
			"{API_ENDPOINT}/gridpoints/{wfo}/{x},{y}/forecast/hourly"
		))
		.await
	}

	#[inline]
	pub async fn forecast_from_grid(
		&self,
		wfo: NwsStation,
		x: u32,
		y: u32,
	) -> crate::Result<ForecastResponse> {
		self.forecast_from_url(format!("{API_ENDPOINT}/gridpoints/{wfo}/{x},{y}/forecast"))
			.await
	}
}
