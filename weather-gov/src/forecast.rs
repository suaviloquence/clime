use chrono::{DateTime, Utc};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Units {
	Us,
	Si,
}

#[derive(Debug, Deserialize)]
pub struct Forecast {
	// TODO:
	// @context: JsonLdContext
	// geometry: Option<String: WKT>
	pub units: Units,
	pub forecast_generator: String,
	pub generated_at: DateTime<Utc>,
	pub update_time: DateTime<Utc>,
	// TODO: type is ISO8601Interval
	pub valid_times: String,
}
