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
}
