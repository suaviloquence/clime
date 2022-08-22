use futures_util::future;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::Executor;

use super::university::University;

#[derive(Debug, Serialize)]
pub struct User {
	pub id: Uuid,
	pub metadata: Metadata,
	pub universities: Vec<i64>,
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

impl Metadata {
	pub async fn load(con: impl Executor<'_>, id: Uuid) -> sqlx::Result<Option<Self>> {
		sqlx::query!("SELECT * FROM users WHERE id = $1", id)
			.fetch_optional(con)
			.await
			.map(|opt| {
				opt.map(|row| Self {
					name: row.name,
					username: row.username,
					units: row.units.as_str().try_into().unwrap(),
					timezone: row.timezone,
				})
			})
	}
}

impl User {
	pub async fn load(con: impl Executor<'_> + Clone, id: Uuid) -> sqlx::Result<Option<Self>> {
		let metadata = Metadata::load(con.clone(), id).await?;

		if let Some(metadata) = metadata {
			let universities = sqlx::query!(
				"SELECT university_id FROM get_weather WHERE user_id = $1",
				id
			)
			.fetch_all(con)
			.await?
			.into_iter()
			.map(|row| row.university_id)
			.collect();

			Ok(Some(Self {
				id,
				metadata,
				universities,
			}))
		} else {
			Ok(None)
		}
	}
}

impl User {
	pub async fn create(con: impl Executor<'_> + Clone, metadata: Metadata) -> sqlx::Result<Self> {
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
		.execute(con)
		.await
		.map(|_| Self {
			id,
			metadata,
			universities: vec![],
		})
	}

	pub async fn update(&self, con: impl Executor<'_>) -> sqlx::Result<()> {
		let units = self.metadata.units.as_str();
		sqlx::query!(
			"UPDATE users SET (name, username, units, timezone) = ($1, $2, $3, $4) WHERE id = $5",
			self.metadata.name,
			self.metadata.username,
			units,
			self.metadata.timezone,
			self.id
		)
		.execute(con)
		.await
		.map(|_| ())
	}

	pub async fn load_universities(
		&self,
		con: impl Executor<'_> + Clone,
	) -> sqlx::Result<Option<Vec<University>>> {
		future::try_join_all(
			self.universities
				.iter()
				.map(|id| University::load(con.clone(), *id)),
		)
		.await
		.map(|universities| universities.into_iter().collect())
	}
}

#[derive(Debug)]
pub struct Authentication {
	pub username: String,
	pub hash: Vec<u8>,
	pub salt: Vec<u8>,
}

impl Authentication {
	pub async fn load(con: impl Executor<'_>, id: &str) -> sqlx::Result<Option<Self>> {
		sqlx::query_as!(Self, "SELECT * FROM authentication WHERE username = $1", id)
			.fetch_optional(con)
			.await
	}

	pub async fn put(&self, con: impl Executor<'_>) -> sqlx::Result<()> {
		sqlx::query!(
			"INSERT INTO authentication (username, hash, salt) VALUES ($1, $2, $3)",
			self.username,
			self.hash,
			self.salt
		)
		.execute(con)
		.await
		.map(|_| ())
	}
}
