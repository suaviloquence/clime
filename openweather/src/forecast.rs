use chrono::{DateTime, Utc};
use serde::Deserialize;

use crate::{
	api_route,
	weather::{CloudInfo, WeatherInfo, WeatherType, WindInfo},
	Client, Coordinates, GET,
};

#[repr(transparent)]
#[derive(Debug, Deserialize, Default)]
pub struct PrecipitationVolume3H {
	/// precipitation volume for the last 3 hours, in millimeters
	#[serde(rename = "3h")]
	pub value: f64,
}

#[derive(Debug, Deserialize)]
pub enum PartOfDay {
	#[serde(rename = "n")]
	Night,
	#[serde(rename = "d")]
	Day,
}

#[derive(Debug, Deserialize)]
pub struct SysInfo {
	pub part_of_day: PartOfDay,
}

#[derive(Debug, Deserialize)]
pub struct CityInfo {
	pub id: u64,
	pub name: String,
	pub coord: Coordinates,
	// TODO: make enum?
	/// two-letter country code
	pub country: String,
	pub population: u64,
	/// seconds offset from UTC
	pub timezone: i32,
	/// time of sunrise
	#[serde(with = "chrono::serde::ts_seconds")]
	pub sunrise: DateTime<Utc>,
	/// time of sunset
	#[serde(with = "chrono::serde::ts_seconds")]
	pub sunset: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct Forecast {
	#[serde(rename = "dt", with = "chrono::serde::ts_seconds")]
	pub time: DateTime<Utc>,
	pub main: WeatherInfo,
	pub weather: Vec<WeatherType>,
	pub clouds: CloudInfo,
	pub wind: WindInfo,
	/// average visibility, in meters. Max is 10 km (10,000 m)
	pub visibility: f32,
	/// percent probabilty of precipitation
	#[serde(rename = "pop")]
	pub precipitation_probability: f32,
	#[serde(default)]
	pub rain: PrecipitationVolume3H,
	#[serde(default)]
	pub snow: PrecipitationVolume3H,
	// TODO: dt_txt: string representation of `time` (dt)
}

#[derive(Debug, Deserialize)]
pub struct ForecastResponse {
	// TODO: cod: string of number, message: int
	pub cnt: u16,
	pub list: Vec<Forecast>,
	pub city: CityInfo,
}

impl Client {
	api_route! {
		GET "/forecast" pub forecast(#[to_string] cnt: u16, coordinates: Coordinates) -> ForecastResponse;
	}
}
