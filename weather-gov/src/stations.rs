use serde::Deserialize;

use crate::{points::ResourceLocation, Client, GeoJsonFeature, Position, QuantitativeValue};
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Station {
	// @context
	pub geometry: Option<String>,
	#[serde(rename = "@id")]
	pub id: ResourceLocation,
	// @type
	pub elevation: QuantitativeValue<f64>,
	pub station_identifier: String,
	pub name: String,
	pub time_zone: String,
	// it is very likely that the following are `Some`, but i found a counterexample
	pub forecast: Option<ResourceLocation>,
	pub county: Option<ResourceLocation>,
	pub fire_weather_zone: Option<ResourceLocation>,
}

#[derive(Debug, Deserialize)]
pub struct StationResponse {
	// @context
	// type: "FeatureCollection"
	#[serde(rename = "features")]
	pub stations: Box<[GeoJsonFeature<Station>]>,
	#[serde(rename = "observationStations")]
	pub station_links: Box<[ResourceLocation]>,
}

// in km
const EARTH_RADIUS: f64 = 6371.0;

// use haversine formula to calculate distance
// assumes earth is a sphere...
pub fn distance(p1: Position, p2: Position) -> f64 {
	(2.0 * EARTH_RADIUS)
		* ((p2.0 - p1.0).sin().powi(2)
			+ p1.0.cos() * p2.0.cos() * (0.5 * (p2.1 - p1.1)).sin().powi(2))
		.sqrt()
		.asin()
}

impl StationResponse {
	pub fn as_closest(&self, point: Position) -> Option<&GeoJsonFeature<Station>> {
		self.stations.iter().min_by(|a, b| {
			distance(point, a.geometry.as_point())
				.partial_cmp(&distance(point, b.geometry.as_point()))
				.unwrap()
		})
	}
}

impl Client {
	pub async fn stations_by_url(&self, url: impl AsRef<str>) -> crate::Result<StationResponse> {
		self.get_geojson(url.as_ref(), None).await
	}

	pub async fn stations(&self, latitude: f64, longitude: f64) -> crate::Result<StationResponse> {
		self.stations_by_url(self.points(latitude, longitude).await?.observation_stations)
			.await
	}
}
