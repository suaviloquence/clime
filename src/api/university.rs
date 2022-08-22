use actix_web::{
	error::{ErrorInternalServerError, ErrorNotFound},
	web::{self, ServiceConfig},
	HttpResponse, Responder, Result,
};
use chrono::Utc;
use openweather_api::Client;
use serde::{Deserialize, Serialize};

use crate::{
	db::Pool,
	models::{forecast::Forecast, university::University, weather::Weather},
};

use super::IntoHttpError;

#[derive(Debug, Deserialize)]
pub struct IdParams {
	id: i64,
}

async fn get_university(con: &Pool, params: web::Path<IdParams>) -> Result<University> {
	match University::load(con, params.id).await {
		Ok(Some(univ)) => Ok(univ),
		Ok(None) => Err(ErrorNotFound("university not found")),
		Err(err) => Err(ErrorInternalServerError(err)),
	}
}

async fn get(con: web::Data<Pool>, params: web::Path<IdParams>) -> Result<impl Responder> {
	let university = get_university(&con, params).await?;

	Ok(HttpResponse::Ok().json(university))
}

#[derive(Debug, Deserialize)]
pub struct SearchParams {
	search: String,
}

#[derive(Debug, Serialize)]
pub struct SearchUniv {
	id: i64,
	name: String,
}

async fn search(con: web::Data<Pool>, query: web::Query<SearchParams>) -> Result<impl Responder> {
	// like ignores case by default (in sqlite)
	// TODO: look into using COLLATE to guarantee this?
	let matches = sqlx::query_as!(
		SearchUniv,
		"SELECT id, name FROM universities WHERE
			name LIKE '%' || $1 || '%' OR
			aliases LIKE '%' || $1 || '%'
		LIMIT 20",
		query.search
	)
	.fetch_all(&**con)
	.await
	.into_500()?;

	Ok(HttpResponse::Ok().json(matches))
}

async fn weather(
	con: web::Data<Pool>,
	client: web::Data<Client>,
	params: web::Path<IdParams>,
) -> Result<impl Responder> {
	let mut weather: Vec<_> = Weather::get_most_recent(con.as_ref(), params.id, 4)
		.await
		.map_err(ErrorInternalServerError)?
		.into_iter()
		.filter(|data| {
			Utc::now()
				.naive_utc()
				.signed_duration_since(data.time)
				.num_hours() <= 4
		})
		.collect();

	if weather.is_empty() {
		let coords = University::get_coordinates(con.as_ref(), params.id)
			.await
			.map_err(ErrorInternalServerError)?
			.ok_or_else(|| ErrorNotFound("university not found"))?;

		let data = Weather::fetch(&client, params.id, &coords)
			.await
			.map_err(ErrorInternalServerError)?;

		data.put(con.as_ref())
			.await
			.map_err(ErrorInternalServerError)?;

		weather.reserve_exact(1);
		weather.push(data);
	}

	Ok(HttpResponse::Ok().json(weather))
}

async fn forecast(
	con: web::Data<Pool>,
	client: web::Data<Client>,
	params: web::Path<IdParams>,
) -> Result<impl Responder> {
	let mut forecasts = Forecast::get_all_since(con.as_ref(), params.id)
		.await
		.into_500()?
		.ok_or_else(|| ErrorNotFound("university not found"))?
		.into_iter()
		.filter(|data| {
			Utc::now()
				.naive_utc()
				.signed_duration_since(data.time)
				.num_hours() <= 40
		})
		.collect::<Vec<_>>();

	if forecasts.is_empty() {
		let coords = University::get_coordinates(con.as_ref(), params.id)
			.await
			.into_500()?
			.ok_or_else(|| ErrorNotFound("university not found"))?;

		forecasts = Forecast::fetch(Client::clone(&client), params.id, &coords, 40)
			.await
			.into_500()?;

		let mut trans = con.begin().await.into_500()?;

		for f in forecasts.iter() {
			f.put(&mut trans).await.into_500()?;
		}

		trans.commit().await.into_500()?;
	}

	Ok(HttpResponse::Ok().json(forecasts))
}

pub(super) fn configure(cfg: &mut ServiceConfig) {
	cfg.service(web::resource("/search").route(web::get().to(search)))
		.service(web::resource("/{id}").route(web::get().to(get)))
		.service(web::resource("/{id}/weather").route(web::get().to(weather)))
		.service(web::resource("/{id}/forecast").route(web::get().to(forecast)));
}
