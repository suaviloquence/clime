use std::sync::Arc;

use log::error;
use reqwest::{header::HeaderValue, Method, RequestBuilder, StatusCode};
use serde::{de::DeserializeOwned, Deserialize, Serialize};

pub mod forecast;
mod options;
pub mod units;
pub mod weather;

pub use options::{Language, Options};
pub use units::Units;

pub(crate) const API_ENDPOINT: &str = "https://api.openweathermap.org/data/2.5";

static USER_AGENT: &str = concat!(env!("CARGO_PKG_NAME"), "/", env!("CARGO_PKG_VERSION"));

#[derive(Debug, thiserror::Error)]
pub enum Error {
	#[error("Error in HTTP request: {0}")]
	Request(reqwest::Error),
	#[error("Too many requests (ran out of API quota)")]
	TooManyRequests,
}

pub(crate) const GET: Method = Method::GET;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Deserialize, Serialize)]
pub struct Coordinates {
	#[serde(rename = "lon")]
	pub longitude: f64,
	#[serde(rename = "lat")]
	pub latitude: f64,
}

#[derive(Debug, Clone)]
pub struct Client(Arc<ClientInner>);

#[derive(Debug)]
struct ClientInner {
	api_key: String,
	// this is double-`Arc`'d, but I don't know how to do it another way...
	client: reqwest::Client,
	options: Options,
}

impl Client {
	pub fn new(
		api_key: String,
		options: Option<Options>,
		user_agent: Option<&'static str>,
	) -> Self {
		let client = reqwest::Client::builder()
			.user_agent(HeaderValue::from_static(user_agent.unwrap_or(USER_AGENT)))
			.build()
			// operations above should be infallible
			.unwrap();

		Self(Arc::new(ClientInner {
			api_key,
			client,
			options: options.unwrap_or_default(),
		}))
	}

	fn build(
		&self,
		method: Method,
		route: &'static str,
		params: Option<&[(&str, &str)]>,
	) -> RequestBuilder {
		let builder = self.0.add_options(
			self.0
				.client
				.request(method, format!("{}{}", API_ENDPOINT, route)),
		);

		if let Some(params) = params {
			builder.query(params)
		} else {
			builder
		}
	}

	async fn handle_response<Res: DeserializeOwned>(&self, builder: RequestBuilder) -> Result<Res> {
		builder
			.send()
			.await
			.map_err(Error::Request)?
			.error_for_status()
			.map_err(|err| match err.status() {
				Some(StatusCode::TOO_MANY_REQUESTS) => {
					error!("API query limit reached.");
					Error::TooManyRequests
				}
				status => {
					error!("Request failed with status {}", status.unwrap_or_default());
					Error::Request(err)
				}
			})?
			.json()
			.await
			.map_err(Error::Request)
	}
}

macro_rules! api_route {
	{
		$(#[$meta:meta])*
		$method:ident $route:literal $vis:vis $name:ident($(#[to_string] $str:ident: $T:ident$(, )?)*$($serarg:ident: $S:ident$(, )?)*) -> $type:ident;
	} => {
			$(#[$meta])*
			$vis async fn $name(&self$(, $str: $T)*$(, $serarg: &$S)*) -> crate::Result<$type> {
				self.handle_response(
					self.build($method, $route, Some(&[$(
						(stringify!($str), &$str.to_string()),
					)*]))
					$(
						.query($serarg)
					)*
				).await
			}
	};
}

pub(crate) use api_route;
