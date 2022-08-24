use serde::Deserialize;

use crate::{Client, API_ENDPOINT};

// TODO
#[derive(Debug, Deserialize)]
#[non_exhaustive]
pub enum NwsForecastOfficeId {
	AKQ,
	ALY,
	BGM,
	BOX,
	BTV,
	BUF,
	CAE,
	CAR,
	CHS,
	CLE,
	CTP,
	GSP,
	GYX,
	ILM,
	ILN,
	LWX,
	MHX,
	OKX,
	PBZ,
	PHI,
	RAH,
	RLX,
	RNK,
	ABQ,
	AMA,
	BMX,
	BRO,
	CRP,
	EPZ,
	EWX,
	FFC,
	FWD,
	HGX,
	HUN,
	JAN,
	JAX,
	KEY,
	LCH,
	LIX,
	LUB,
	LZK,
	MAF,
	MEG,
	MFL,
	MLB,
	MOB,
	MRX,
	OHX,
	OUN,
	SHV,
	SJT,
	SJU,
	TAE,
	TBW,
	TSA,
	ABR,
	APX,
	ARX,
	BIS,
	BOU,
	CYS,
	DDC,
	DLH,
	DMX,
	DTX,
	DVN,
	EAX,
	FGF,
	FSD,
	GID,
	GJT,
	GLD,
	GRB,
	GRR,
	ICT,
	ILX,
	IND,
	IWX,
	JKL,
	LBF,
	LMK,
	LOT,
	LSX,
	MKX,
	MPX,
	MQT,
	OAX,
	PAH,
	PUB,
	RIW,
	SGF,
	TOP,
	UNR,
	BOI,
	BYZ,
	EKA,
	FGZ,
	GGW,
	HNX,
	LKN,
	LOX,
	MFR,
	MSO,
	MTR,
	OTX,
	PDT,
	PIH,
	PQR,
	PSR,
	REV,
	SEW,
	SGX,
	SLC,
	STO,
	TFX,
	TWC,
	VEF,
	AER,
	AFC,
	AFG,
	AJK,
	ALU,
	GUM,
	HPA,
	HFO,
	PPG,
	STU,
	NH1,
	NH2,
	ONA,
	ONP,
}

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
	pub cwa: NwsForecastOfficeId,
	pub forecast_office: String,
	pub grid_id: NwsForecastOfficeId,
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
		self.get(format!("{API_ENDPOINT}/points/{latitude},{longitude}"))
			.await
	}
}
