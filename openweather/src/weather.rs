use chrono::{DateTime, Utc};
use log::debug;
use serde::{Deserialize, Serialize};

use crate::{
	units::{Speed, Temperature},
	Client, Error, API_ENDPOINT,
};

#[derive(Debug, Deserialize, Serialize)]
pub struct Coordinates {
	#[serde(rename = "lon")]
	pub longitude: f64,
	#[serde(rename = "lat")]
	pub latitude: f64,
}

#[derive(Debug, Deserialize)]
pub struct WeatherType {
	pub id: u64,
	pub main: String,
	pub description: String,
	pub icon: String,
}

#[derive(Debug, Deserialize)]
pub struct WeatherInfo {
	/// the temperature of the weather (units depends on client options, see [`Units`])
	pub temp: Temperature,
	/// the temperature it feels like to humans
	pub feels_like: Temperature,
	/// minimum observed temperature at the moment (e.g., for large areas)
	pub temp_min: Temperature,
	/// maximum observed temperature at the moment (e.g., for large areas)
	pub temp_max: Temperature,
	/// percent humidity
	pub humidity: f32,
	/// atmospheric pressure at sea level, in hPa
	#[serde(alias = "pressure")]
	pub sea_level: f64,
	/// atmospheric pressure at ground level, in hPa,
	#[serde(rename = "grnd_level")]
	pub ground_level: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct WindInfo {
	/// speed of the wind
	pub speed: Speed,
	/// direction of the wind, in meteorological degrees
	#[serde(rename = "deg")]
	pub direction: f32,
	/// [gust](https://en.wikipedia.org/wiki/Wind_gust) of the wind
	pub gust: Speed,
}

#[derive(Debug, Deserialize)]
pub struct CloudInfo {
	/// cloudiness
	#[serde(rename = "all")]
	pub cloudiness: f32,
}

#[derive(Debug, Deserialize)]
pub struct PrecipitationVolume {
	/// precipitation volume for the last 1 hour, in millimeters
	#[serde(rename = "1h")]
	pub one_hour: f64,
	/// precipitation volume for the last 3 hours, in millimeters
	#[serde(rename = "3h")]
	pub three_hours: f64,
}

#[derive(Debug, Deserialize)]
pub struct SysInfo {
	// TODO:  type: int, id: int, message: float?
	/// country code
	pub country: String,
	/// time of sunrise
	#[serde(with = "chrono::serde::ts_seconds")]
	pub sunrise: DateTime<Utc>,
	/// time of sunset
	#[serde(with = "chrono::serde::ts_seconds")]
	pub sunset: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct WeatherResponse {
	pub coord: Coordinates,
	pub weather: WeatherType,
	/// maximum visibility, in meters.  Max is 10 km (10,000 m)
	pub visibility: f32,
	pub wind: WindInfo,
	pub clouds: CloudInfo,
	/// rain volume
	pub rain: PrecipitationVolume,
	/// snow volume
	pub snow: PrecipitationVolume,
	/// time of data calculation (UTC)
	#[serde(rename = "dt", with = "chrono::serde::ts_seconds")]
	pub time_calculated: DateTime<Utc>,
	/// miscellaneous/system info
	pub sys: SysInfo,
	/// timezone -- difference in seconds from UTC
	pub timezone: i32,
	/// city id
	pub id: u64,
	/// name of city
	pub name: String,
	// TODO: cod: int
}

impl Client {
	pub async fn weather_at(&self, coordinates: &Coordinates) -> crate::Result<WeatherResponse> {
		debug!(
			"{}",
			serde_json::to_string_pretty(
				&self
					.add_options(self.client.get(format!("{}/weather", API_ENDPOINT)))
					.query(&[("appid", &self.api_key)])
					.query(coordinates)
					.send()
					.await
					.map_err(Error::Request)?
					.json::<serde_json::Value>()
					.await
					.map_err(Error::Request)?
			)
			.unwrap()
		);
		panic!();
	}
}
