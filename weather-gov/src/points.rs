use serde::Deserialize;

use crate::{Client, NwsStation, API_ENDPOINT};

// TODO

#[derive(Debug, Deserialize)]
#[serde(transparent)]
pub struct ResourceLocation(String);

impl AsRef<str> for ResourceLocation {
	fn as_ref(&self) -> &str {
		&self.0
	}
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Point {
	// TODO:
	// @context: JsonLdContext
	// geometry: Option<GeometryString> (i.e., WKT)
	// @id: ResourceLocation
	// @type: ["wx:Point"]
	pub cwa: NwsStation,
	pub forecast_office: String,
	pub grid_id: NwsStation,
	pub grid_x: u32,
	pub grid_y: u32,
	pub forecast: ResourceLocation,
	pub forecast_hourly: ResourceLocation,
	pub forecast_grid_data: ResourceLocation,
	pub observation_stations: ResourceLocation,
	// TODO: pub relative_location:
	pub forecast_zone: ResourceLocation,
	pub county: ResourceLocation,
	pub fire_weather_zone: ResourceLocation,
	pub time_zone: String,
	pub radar_station: String,
}

impl Client {
	pub async fn points(&self, latitude: f64, longitude: f64) -> crate::Result<Point> {
		self.get_ld(
			format!("{API_ENDPOINT}/points/{latitude},{longitude}"),
			None,
		)
		.await
	}
}
