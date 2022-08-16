use sqlx::pool::PoolOptions;

#[cfg(all(feature = "postgres", feature = "sqlite"))]
compile_error!("Only one database is supported.");

#[cfg(feature = "sqlite")]
type DB = sqlx::Sqlite;

#[cfg(feature = "postgres")]
type DB = sqlx::Postgres;

pub type Pool = sqlx::Pool<DB>;

pub trait Executor<'a>: sqlx::Executor<'a, Database = DB> {}
impl<'a, T: sqlx::Executor<'a, Database = DB>> Executor<'a> for T {}

pub async fn create(url: &str) -> sqlx::Result<Pool> {
	PoolOptions::new().connect(url).await
}
