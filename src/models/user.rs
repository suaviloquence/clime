use std::sync::Arc;

use futures_util::future::BoxFuture;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::Pool;

use super::{university::University, Lazy, Load};

#[derive(Debug, Serialize)]
pub struct User {
	pub id: Uuid,
	pub name: String,
	pub username: String,
	pub universities: Lazy<Vec<University>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Metadata {
	pub name: String,
	pub username: String,
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
			let metadata = sqlx::query_as!(Metadata, "SELECT name, username FROM users")
				.fetch_optional(con.as_ref())
				.await?;

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
					name: metadata.name,
					username: metadata.username,
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
		sqlx::query!(
			"INSERT INTO users (id, name, username) VALUES ($1, $2, $3)",
			id,
			metadata.name,
			metadata.username
		)
		.execute(con.as_ref())
		.await
		.map(|_| Self {
			id,
			name: metadata.name,
			username: metadata.username,
			universities: Lazy::Lazy(Vec::new()),
		})
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
