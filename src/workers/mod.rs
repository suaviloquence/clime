use std::fmt::Debug;
use std::time::Duration;

use actix::{Actor, AsyncContext, Context, WrapFuture};
use chrono::Utc;
use futures_util::Future;

pub mod forecast;
pub mod weather;

pub trait Update: Debug + Clone + Unpin + 'static {
	const INTERVAL_LENGTH: Duration;

	type Future: Future<Output = anyhow::Result<()>>;

	fn update(self) -> Self::Future;
}

#[derive(Debug)]
pub struct Updater<U: Update> {
	update: U,
}

impl<U: Update> Updater<U> {
	pub fn start(update: U) {
		Self { update }.start();
	}
}

impl<U: Update> Actor for Updater<U> {
	type Context = Context<Self>;

	fn started(&mut self, ctx: &mut Self::Context) {
		log::info!(
			"Waiting to run until {:?}",
			next_interval(U::INTERVAL_LENGTH)
		);

		ctx.run_later(next_interval(U::INTERVAL_LENGTH), move |this, ctx| {
			log::info!("Starting interval of {:?}", U::INTERVAL_LENGTH);
			this.run(ctx);
			ctx.run_interval(U::INTERVAL_LENGTH, Self::run);
		});
	}
}

impl<U: Update> Updater<U> {
	fn run(&mut self, ctx: &mut <Self as Actor>::Context) {
		let update = self.update.clone();

		ctx.spawn(
			async move {
				if let Err(e) = update.update().await {
					log::error!("Error running updater: {:?}", e);
				}
			}
			.into_actor(self),
		);
	}
}

fn next_interval(interval_length: Duration) -> Duration {
	Duration::from_secs(
		interval_length.as_secs() - Utc::now().timestamp() as u64 % interval_length.as_secs(),
	)
}
