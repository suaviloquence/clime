use std::sync::Arc;

use futures_util::future::BoxFuture;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::Pool;

use super::{university::University, Lazy, Load};

#[derive(Debug, Serialize)]
pub struct User {
	pub id: Uuid,
	pub metadata: Metadata,
	pub universities: Lazy<Vec<University>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum Units {
	Imperial,
	Metric,
}

impl Units {
	#[inline]
	pub const fn as_str(&self) -> &'static str {
		match &self {
			Self::Imperial => "imperial",
			Self::Metric => "metric",
		}
	}
}

impl<'a> TryFrom<&'a str> for Units {
	type Error = ();

	fn try_from(value: &'a str) -> Result<Self, Self::Error> {
		match value {
			"imperial" => Ok(Self::Imperial),
			"metric" => Ok(Self::Metric),
			_ => Err(()),
		}
	}
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Metadata {
	pub name: String,
	pub username: String,
	pub units: Units,
	pub timezone: Option<i64>,
}

impl Load for Metadata {
	type ID = Uuid;

	type Error = sqlx::Error;

	type Connection = Arc<Pool>;

	fn load(
		con: Self::Connection,
		id: Self::ID,
	) -> BoxFuture<'static, Result<Option<Self>, Self::Error>> {
		Box::pin(async move {
			sqlx::query!("SELECT * FROM users WHERE id = $1", id)
				.fetch_optional(con.as_ref())
				.await
				.map(|opt| {
					opt.map(|row| Self {
						name: row.name,
						username: row.username,
						units: row.units.as_str().try_into().unwrap(),
						timezone: row.timezone,
					})
				})
		})
	}
}

impl Load for User {
	type Connection = Arc<Pool>;
	type ID = Uuid;
	type Error = sqlx::Error;

	fn load(
		con: Self::Connection,
		id: Self::ID,
	) -> BoxFuture<'static, Result<Option<Self>, Self::Error>> {
		Box::pin(async move {
			let metadata = Metadata::load(Arc::clone(&con), id).await?;

			if let Some(metadata) = metadata {
				let universities = sqlx::query!(
					"SELECT university_id FROM get_weather WHERE user_id = $1",
					id
				)
				.fetch_all(con.as_ref())
				.await?
				.into_iter()
				.map(|row| row.university_id)
				.collect();
				Ok(Some(Self {
					id,
					metadata,
					universities: Lazy::Lazy(universities),
				}))
			} else {
				Ok(None)
			}
		})
	}
}

impl User {
	pub async fn create(con: Arc<Pool>, metadata: Metadata) -> sqlx::Result<Self> {
		let id = Uuid::new_v4();

		let units = metadata.units.as_str();
		sqlx::query!(
			"INSERT INTO users (id, name, username, units, timezone) VALUES ($1, $2, $3, $4, $5)",
			id,
			metadata.name,
			metadata.username,
			units,
			metadata.timezone,
		)
		.execute(con.as_ref())
		.await
		.map(|_| Self {
			id,
			metadata,
			universities: Lazy::Lazy(vec![]),
		})
	}

	pub async fn update(&self, con: Arc<Pool>) -> sqlx::Result<()> {
		let units = self.metadata.units.as_str();
		sqlx::query!(
			"UPDATE users SET (name, username, units, timezone) = ($1, $2, $3, $4) WHERE id = $5",
			self.metadata.name,
			self.metadata.username,
			units,
			self.metadata.timezone,
			self.id
		)
		.execute(con.as_ref())
		.await
		.map(|_| ())
	}
}

#[derive(Debug)]
pub struct Authentication {
	pub username: String,
	pub hash: Vec<u8>,
	pub salt: Vec<u8>,
}

impl Load for Authentication {
	type ID = String;

	type Error = sqlx::Error;

	type Connection = Arc<Pool>;

	fn load(
		con: Self::Connection,
		id: Self::ID,
	) -> BoxFuture<'static, Result<Option<Self>, Self::Error>> {
		Box::pin(async move {
			sqlx::query_as!(Self, "SELECT * FROM authentication WHERE username = $1", id)
				.fetch_optional(con.as_ref())
				.await
		})
	}
}

impl Authentication {
	pub async fn put(&self, con: Arc<Pool>) -> sqlx::Result<()> {
		sqlx::query!(
			"INSERT INTO authentication (username, hash, salt) VALUES ($1, $2, $3)",
			self.username,
			self.hash,
			self.salt
		)
		.execute(con.as_ref())
		.await
		.map(|_| ())
	}
}
