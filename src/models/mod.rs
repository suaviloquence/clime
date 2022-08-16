use futures_util::future::{self, BoxFuture};
use serde::Serialize;

pub mod forecast;
pub mod university;
pub mod user;
pub mod weather;

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum Lazy<T: Load> {
	Lazy(T::ID),
	Eager(T),
}

impl<T: Load> Lazy<T> {
	pub async fn load(self, con: T::Connection) -> Result<Option<T>, T::Error> {
		match self {
			Self::Lazy(id) => T::load(con, id).await,
			Self::Eager(t) => Ok(Some(t)),
		}
	}
}

pub trait Load: Sized {
	type ID;
	type Error;
	type Connection;

	fn load(
		con: Self::Connection,
		id: Self::ID,
	) -> BoxFuture<'static, Result<Option<Self>, Self::Error>>;
}

impl<T: Load> Load for Vec<T>
where
	T: Send + 'static,
	T::ID: Send + 'static,
	T::Error: Send + 'static,
	T::Connection: Clone + Send + 'static,
{
	type ID = Vec<T::ID>;
	type Error = T::Error;
	type Connection = T::Connection;

	fn load(
		con: Self::Connection,
		ids: Self::ID,
	) -> BoxFuture<'static, Result<Option<Self>, Self::Error>> {
		let fut = future::join_all(ids.into_iter().map(|id| T::load(con.clone(), id)));

		Box::pin(async move { fut.await.into_iter().collect() })
	}
}
