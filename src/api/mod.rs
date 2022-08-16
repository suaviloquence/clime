use std::fmt;

use actix_web::{
	error::ErrorInternalServerError,
	web::{self, ServiceConfig},
};
use log::info;

mod university;
mod user;

pub trait IntoHttpError<T> {
	fn into_500(self) -> actix_web::Result<T>;
}

impl<T, E: fmt::Debug + fmt::Display + 'static> IntoHttpError<T> for Result<T, E> {
	#[inline]
	fn into_500(self) -> actix_web::Result<T> {
		self.map_err(ErrorInternalServerError)
	}
}

pub fn configure(cfg: &mut ServiceConfig) {
	cfg.app_data(web::JsonConfig::default().error_handler(|err, _| {
		info!("Error deserializing JSON: {:?}", err);
		actix_web::error::ErrorBadRequest(err)
	}))
	.service(web::scope("/university").configure(university::configure))
	.service(web::scope("/user").configure(user::configure));
}
