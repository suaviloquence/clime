use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_repr::Deserialize_repr;

use crate::{
	api_route,
	units::{Speed, Temperature},
	Client, Coordinates, GET,
};

#[repr(u32)]
#[derive(Debug, Deserialize_repr)]
/// https://openweathermap.org/weather-conditions
pub enum WeatherCondition {
	ThunderstormLightRain = 200,
	ThunderstormRain = 201,
	ThunderstormHeavyRain = 202,
	LightThunderstorm = 210,
	Thunderstorm = 211,
	HeavyThunderstorm = 212,
	RaggedThunderstorm = 221,
	ThunderstormLightDrizzle = 230,
	ThunderstormDrizzle = 231,
	ThunderstormHeavyDrizzle = 232,
	LightIntensityDrizzle = 300,
	Drizzle = 301,
	HeavyIntensityDrizzle = 302,
	LightIntensityDrizzleRain = 310,
	DrizzleRain = 311,
	HeavyIntensityDrizzleRain = 312,
	ShowerRainAndDrizzle = 313,
	HeavyShowerRainAndDrizzle = 314,
	ShowerDrizzle = 321,
	LightRain = 500,
	ModerateRain = 501,
	HeavyIntensityRain = 502,
	VeryHeavyRain = 503,
	ExtremeRain = 504,
	FreezingRain = 511,
	LightIntensityShowerRain = 521,
	ShowerRain = 522,
	RaggedShowerRain = 531,
	LightSnow = 600,
	Snow = 601,
	HeavySnow = 602,
	Sleet = 611,
	LightShowerSleet = 612,
	ShowerSleet = 613,
	LightRainAndSnow = 615,
	RainAndSnow = 616,
	LightShowerSnow = 620,
	ShowerSnow = 621,
	HeavyShowerSnow = 622,
	Mist = 701,
	Smoke = 711,
	Haze = 721,
	SandDustWhirls = 731,
	Fog = 741,
	Sand = 751,
	Dust = 761,
	Ash = 762,
	Squall = 771,
	Tornado = 7781,
	Clear = 800,
	/// 11-25%
	FewClouds = 801,
	/// 25-50%
	ScatteredClouds = 802,
	/// 51-84%
	BrokenClouds = 803,
	/// 85-100% clouds
	Overcast = 804,
}

#[derive(Debug, Deserialize)]
pub struct WeatherType {
	pub id: WeatherCondition,
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
	/// atmospheric pressure.  If [`sea_level_pressure`](#sea_level_pressure) and [`ground_level_pressure`](#ground_level_pressure) are `None`, this is measured at sea level.
	pub pressure: f64,
	/// atmospheric pressure at sea level, in hPa
	#[serde(rename = "sea_level")]
	pub sea_level_pressure: Option<f64>,
	/// atmospheric pressure at ground level, in hPa,
	#[serde(rename = "grnd_level")]
	pub ground_level_pressure: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct WindInfo {
	/// speed of the wind
	pub speed: Speed,
	/// direction of the wind, in meteorological degrees
	#[serde(rename = "deg")]
	pub direction: f32,
	/// [gust](https://en.wikipedia.org/wiki/Wind_gust) of the wind
	pub gust: Option<Speed>,
}

#[derive(Debug, Deserialize)]
pub struct CloudInfo {
	/// cloudiness
	#[serde(rename = "all")]
	pub cloudiness: f32,
}

#[derive(Debug, Deserialize, Default)]
pub struct PrecipitationVolume {
	/// precipitation volume for the last 1 hour, in millimeters
	#[serde(rename = "1h")]
	pub one_hour: Option<f64>,
	/// precipitation volume for the last 3 hours, in millimeters
	#[serde(rename = "3h")]
	pub three_hours: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct SysInfo {
	// TODO:  type: int, id: int, message: float?
	/// country code
	pub country: Option<String>,
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
	pub weather: Vec<WeatherType>,
	/// info about main weather
	pub main: WeatherInfo,
	/// maximum visibility, in meters.  Max is 10 km (10,000 m)
	pub visibility: f32,
	pub wind: WindInfo,
	pub clouds: CloudInfo,
	/// rain volume
	#[serde(default)]
	pub rain: PrecipitationVolume,
	/// snow volume
	#[serde(default)]
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
	api_route! {
		/// Find the weather at the given coordinates.
		GET "/weather" pub weather_at(coordinates: Coordinates) -> WeatherResponse;
	}

	api_route! {
		/// Find the weather in an area with a given latitude and longitude
		GET "/weather" pub weather(#[to_string] lat: f64, #[to_string] lon: f64) -> WeatherResponse;
	}
}
