use points::ResourceLocation;
use reqwest::{
	header::{HeaderName, HeaderValue, ACCEPT},
	IntoUrl, Response,
};
use serde::{de::DeserializeOwned, Deserialize};

pub const API_ENDPOINT: &str = "https://api.weather.gov";

pub mod forecast;
pub mod observations;
pub mod points;
pub mod stations;

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct QuantitativeValue<N> {
	pub value: Option<N>,
	pub max_value: Option<N>,
	pub min_value: Option<N>,
	pub unit_code: String,
	// quality code?
}

impl<N: Copy> QuantitativeValue<N> {
	#[inline]
	pub fn get_value(&self) -> Option<N> {
		// TODO: should it return max value first?
		self.value.or_else(|| self.max_value.or(self.min_value))
	}
}

pub type Position = (f64, f64);
pub type Bbox = Option<Box<[Position]>>;

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum GeoJsonGeometry {
	Point {
		coordinates: Position,
		// minItems: 4
		bbox: Bbox,
	},
	LineString {
		coordinates: Box<[Position]>,
		bbox: Bbox,
	},
	Polygon {
		coordinates: Box<[Position]>,
		bbox: Bbox,
	},
	MultiPoint {
		coordinates: Box<[Position]>,
		bbox: Bbox,
	},
	MultiLineString {
		coordinates: Box<[Box<[Position]>]>,
		bbox: Bbox,
	},
	MultiPolygon {
		coordinates: Box<[Box<[Position]>]>,
		bbox: Bbox,
	},
}

impl GeoJsonGeometry {
	// probably shouldn't use this lol
	#[inline]
	pub fn as_point(&self) -> Position {
		match self {
			Self::Point { coordinates, .. } => *coordinates,
			Self::LineString { coordinates, .. } => coordinates[0],
			Self::Polygon { coordinates, .. } => coordinates[0],
			Self::MultiLineString { coordinates, .. } => coordinates[0][0],
			Self::MultiPoint { coordinates, .. } => coordinates[0],
			Self::MultiPolygon { coordinates, .. } => coordinates[0][0],
		}
	}
}

#[derive(Debug, Deserialize)]
pub struct GeoJsonFeature<T> {
	// @context
	pub id: ResourceLocation,
	// type: "Feature"
	pub geometry: GeoJsonGeometry,
	pub properties: T,
}

impl<T> AsRef<T> for GeoJsonFeature<T> {
	fn as_ref(&self) -> &T {
		&self.properties
	}
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
	#[error("Error in HTTP request: {0}")]
	Request(reqwest::Error),
	#[error("Error in JSON deserializing: {0}")]
	Json(reqwest::Error),
}

macro_rules! stations {
		($($name:ident, )*) => {
			#[derive(Debug, Deserialize, Clone)]
			pub enum NwsStation {
				$($name,)*
			}

			impl AsRef<str> for NwsStation {
				fn as_ref(&self) -> &str {
					match &self {
						$(
							&Self::$name => stringify!($name),
						)*
					}
				}
			}

			impl std::fmt::Display for NwsStation {
				fn fmt(&self, fmt: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
					write!(fmt, "{}", self.as_ref())
				}
			}
		};
}

stations!(
	AKQ, ALY, BGM, BOX, BTV, BUF, CAE, CAR, CHS, CLE, CTP, GSP, GYX, ILM, ILN, LWX, MHX, OKX, PBZ,
	PHI, RAH, RLX, RNK, ABQ, AMA, BMX, BRO, CRP, EPZ, EWX, FFC, FWD, HGX, HUN, JAN, JAX, KEY, LCH,
	LIX, LUB, LZK, MAF, MEG, MFL, MLB, MOB, MRX, OHX, OUN, SHV, SJT, SJU, TAE, TBW, TSA, ABR, APX,
	ARX, BIS, BOU, CYS, DDC, DLH, DMX, DTX, DVN, EAX, FGF, FSD, GID, GJT, GLD, GRB, GRR, ICT, ILX,
	IND, IWX, JKL, LBF, LMK, LOT, LSX, MKX, MPX, MQT, OAX, PAH, PUB, RIW, SGF, TOP, UNR, BOI, BYZ,
	EKA, FGZ, GGW, HNX, LKN, LOX, MFR, MSO, MTR, OTX, PDT, PIH, PQR, PSR, REV, SEW, SGX, SLC, STO,
	TFX, TWC, VEF, AER, AFC, AFG, AJK, ALU, GUM, HPA, HFO, PPG, STU, NH1, NH2, ONA, ONP,
);

pub type Result<T> = ::core::result::Result<T, Error>;

#[derive(Debug, Clone)]
pub struct Client(pub(crate) reqwest::Client);

const LD_JSON: HeaderValue = HeaderValue::from_static("application/ld+json");
const GEO_JSON: HeaderValue = HeaderValue::from_static("application/geo+json");

impl Client {
	/// Creates a new `Client` instance with the given user agent
	/// Note from weather.gov on user agents:
	/// > A User Agent is required to identify your application. This string can be anything, and the more unique to your application the less likely it will be affected by a security event. If you include contact information (website or email), we can contact you if your string is associated to a security event. This will be replaced with an API key in the future.
	pub fn new(user_agent: &str) -> Self {
		Self(
			reqwest::Client::builder()
				.user_agent(user_agent)
				.https_only(true)
				.build()
				// this shouldn't happen
				.expect("Client::new failed"),
		)
	}

	async fn get<U: IntoUrl, D: DeserializeOwned>(
		&self,
		url: U,
		accept: HeaderValue,
		feature_flags: Option<HeaderValue>,
	) -> Result<D> {
		let req = self.0.get(url).header(ACCEPT, accept);

		if let Some(feature_flags) = feature_flags {
			req.header(HeaderName::from_static("feature-flags"), feature_flags)
		} else {
			req
		}
		.send()
		.await
		.and_then(Response::error_for_status)
		.map_err(Error::Request)?
		.json()
		.await
		.map_err(Error::Json)
	}

	#[inline]
	async fn get_ld<U: IntoUrl, D: DeserializeOwned>(
		&self,
		url: U,
		feature_flags: Option<HeaderValue>,
	) -> Result<D> {
		self.get(url, LD_JSON, feature_flags).await
	}

	#[inline]
	async fn get_geojson<U: IntoUrl, D: DeserializeOwned>(
		&self,
		url: U,
		feature_flags: Option<HeaderValue>,
	) -> Result<D> {
		self.get(url, GEO_JSON, feature_flags).await
	}
}
