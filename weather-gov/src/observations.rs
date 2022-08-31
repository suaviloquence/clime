use chrono::{DateTime, Utc};
use serde::Deserialize;

use crate::{points::ResourceLocation, Client, QuantitativeValue};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MetarIntensity {
	Light,
	Heavy,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MetarModifier {
	Patches,
	Blowing,
	LowDrifting,
	Freezing,
	Shallow,
	Partial,
	Showers,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MetarWeather {
	FogMist,
	DustStorm,
	Dust,
	Drizzle,
	FunnelCloud,
	Fog,
	Smoke,
	Hail,
	SnowPellets,
	Haze,
	IceCrystals,
	IcePellets,
	DustWhirls,
	Spray,
	Rain,
	Sand,
	SnowGrains,
	Snow,
	Squalls,
	SandStorm,
	Thunderstorms,
	Unknown,
	VolcanicAsh,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetarPhenomenon {
	pub intensity: Option<MetarIntensity>,
	pub modifier: Option<MetarModifier>,
	pub weather: MetarWeather,
	pub raw_string: Option<String>,
	pub in_vicinity: bool,
}

// TODO: what does this mean?
#[derive(Debug, Deserialize)]
pub enum MetarSkyCoverage {
	OVC,
	BKN,
	SCT,
	FEW,
	SKC,
	CLR,
	VV,
}

#[derive(Debug, Deserialize)]
pub struct CloudLayers {
	pub base: QuantitativeValue<f64>,
	pub amount: MetarSkyCoverage,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Observation {
	// @context, geometry, @id, @type
	pub elevation: QuantitativeValue<f64>,
	pub station: ResourceLocation,
	pub timestamp: DateTime<Utc>,
	pub raw_message: String,
	pub text_description: String,
	#[deprecated]
	pub icon: Option<ResourceLocation>,
	pub present_weather: Box<[MetarPhenomenon]>,
	pub temperature: QuantitativeValue<f64>,
	pub dewpoint: QuantitativeValue<f64>,
	pub wind_direction: QuantitativeValue<f64>,
	pub wind_speed: QuantitativeValue<f64>,
	pub wind_gust: QuantitativeValue<f64>,
	pub barometric_pressure: QuantitativeValue<f64>,
	pub sea_level_pressure: QuantitativeValue<f64>,
	pub visibility: QuantitativeValue<f64>,
	pub max_temperature_last_24_hours: QuantitativeValue<f64>,
	pub min_temperature_last_24_hours: QuantitativeValue<f64>,
	#[serde(default)]
	pub precipitation_last_hour: QuantitativeValue<f64>,
	#[serde(default)]
	pub precipitation_last_3_hours: QuantitativeValue<f64>,
	#[serde(default)]
	pub precipitation_last_6_hours: QuantitativeValue<f64>,
	pub relative_humidity: QuantitativeValue<f64>,
	pub wind_chill: QuantitativeValue<f64>,
	pub heat_index: QuantitativeValue<f64>,
	pub cloud_layers: Box<[CloudLayers]>,
}

#[derive(Debug, Deserialize)]
pub struct Observations {
	// @context
	#[serde(rename = "@graph")]
	pub observations: Box<[Observation]>,
}

impl Client {
	#[inline]
	// TODO: require_qc option (QualityControl in quantitative values?)
	pub async fn latest_observation(&self, station: impl AsRef<str>) -> crate::Result<Observation> {
		self.get_ld(format!("{}/observations/latest", station.as_ref()), None)
			.await
	}

	// usually only works for round intervals (hours?)
	#[inline]
	pub async fn observation_at_time(
		&self,
		station: impl AsRef<str>,
		time: DateTime<Utc>,
	) -> crate::Result<Observation> {
		self.get_ld(
			format!(
				"{}/observations/{}",
				station.as_ref(),
				time.format("%Y-%m-%dT%H:%M:%SZ")
			),
			None,
		)
		.await
	}

	pub async fn observations(&self, station: impl AsRef<str>) -> crate::Result<Observations> {
		self.get_ld(format!("{}/observations", station.as_ref()), None)
			.await
	}
}
