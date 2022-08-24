use reqwest::{
	header::{HeaderValue, ACCEPT},
	IntoUrl,
};
use serde::{de::DeserializeOwned, Deserialize};

pub const API_ENDPOINT: &str = "https://api.weather.gov";

pub mod forecast;
pub mod points;

#[derive(Debug, Deserialize)]
/// see https://madis.ncep.noaa.gov/madis_sfc_qc_notes.shtml
pub enum QualityCode {
	Z,
	C,
	S,
	V,
	X,
	Q,
	G,
	B,
	T,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuantitativeValue<N> {
	pub value: Option<N>,
	pub max_value: N,
	pub min_value: N,
	pub unit_code: String,
	pub quality_control: QualityCode,
}

const USER_AGENT: &str = concat!(env!("CARGO_PKG_NAME"), "/", env!("CARGO_PKG_VERSION"));

#[derive(Debug, thiserror::Error)]
pub enum Error {
	#[error("Error in HTTP request: {0}")]
	Request(reqwest::Error),
	#[error("Error in JSON deserializing: {0}")]
	Json(reqwest::Error),
}

pub type Result<T> = ::core::result::Result<T, Error>;

#[derive(Debug, Clone)]
pub struct Client(pub(crate) reqwest::Client);

impl Client {
	pub fn from_client(client: reqwest::Client) -> Self {
		Self(client)
	}

	pub fn new() -> Self {
		Self(
			reqwest::Client::builder()
				.user_agent(USER_AGENT)
				.https_only(true)
				.build()
				// this shouldn't happen
				.expect("Client::new failed"),
		)
	}

	pub async fn get<U: IntoUrl, D: DeserializeOwned>(&self, url: U) -> Result<D> {
		self.0
			.get(url)
			.header(ACCEPT, HeaderValue::from_static("application/ld+json"))
			.send()
			.await
			.map_err(Error::Request)?
			.json()
			.await
			.map_err(Error::Json)
	}
}
