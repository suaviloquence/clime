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
	pub universities: Lazy<Vec<University>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Metadata {
	pub name: String,
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
			let metadata = sqlx::query_as!(Metadata, "SELECT name FROM users")
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
			"INSERT INTO users (id, name) VALUES ($1, $2)",
			id,
			metadata.name
		)
		.execute(con.as_ref())
		.await
		.map(|_| Self {
			id,
			name: metadata.name,
			universities: Lazy::Lazy(Vec::new()),
		})
	}
}
