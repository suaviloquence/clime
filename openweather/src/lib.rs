use reqwest::header::HeaderValue;

mod options;
pub mod units;
mod weather;

pub use options::{Language, Options};
pub use units::Units;

pub(crate) const API_ENDPOINT: &str = "https://api.openweathermap.org/data/2.5";

static USER_AGENT: &str = concat!(env!("CARGO_PKG_NAME"), "/", env!("CARGO_PKG_VERSION"));

#[derive(Debug, thiserror::Error)]
pub enum Error {
	#[error("Error in HTTP request")]
	Request(reqwest::Error),
}

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug)]
pub struct Client {
	api_key: String,
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

		Self {
			api_key,
			client,
			options: options.unwrap_or_default(),
		}
	}
}

#[cfg(test)]
mod tests {
	use crate::{weather::Coordinates, Client};

	#[tokio::test]
	async fn req() {
		std::env::set_var("RUST_LOG", "trace");
		env_logger::init();
		let client = Client::new(std::env::var("API_KEY").unwrap(), Default::default(), None);

		println!(
			"{:?}",
			client
				.weather_at(&Coordinates {
					latitude: 37.3,
					longitude: -121.8
				})
				.await
		);

		panic!()
	}
}
