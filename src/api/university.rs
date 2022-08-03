use actix_web::{
	error::{ErrorInternalServerError, ErrorNotFound},
	web::{self, ServiceConfig},
	HttpResponse,
};
use chrono::Utc;
use openweather::Client;
use serde::{Deserialize, Serialize};

use crate::{
	db::Pool,
	models::{university::University, weather::Weather, Load},
};

use super::Response;

#[derive(Debug, Deserialize)]
pub struct IdParams {
	id: i64,
}

async fn get_university(
	con: &web::Data<Pool>,
	params: web::Path<IdParams>,
) -> actix_web::Result<University> {
	match University::load(Pool::clone(&con), params.id).await {
		Ok(Some(univ)) => Ok(univ),
		Ok(None) => Err(ErrorNotFound("university not found")),
		Err(err) => Err(ErrorInternalServerError(err)),
	}
}

async fn get(con: web::Data<Pool>, params: web::Path<IdParams>) -> Response {
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

async fn search(con: web::Data<Pool>, query: web::Query<SearchParams>) -> Response {
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
	.map_err(actix_web::error::ErrorInternalServerError)?;

	Ok(HttpResponse::Ok().json(matches))
}

async fn weather(
	con: web::Data<Pool>,
	client: web::Data<Client>,
	params: web::Path<IdParams>,
) -> Response {
	let mut weather: Vec<_> = Weather::get_most_recent(&con, params.id, 4)
		.await
		.map_err(ErrorInternalServerError)?
		.into_iter()
		.zip(1i64..)
		.filter(|(data, i)| {
			Utc::now()
				.naive_utc()
				.signed_duration_since(data.time)
				.num_hours() <= *i
		})
		.map(|(data, _)| data)
		.collect();

	if weather.is_empty() {
		let coords = sqlx::query_as!(
			openweather::Coordinates,
			"SELECT latitude, longitude FROM universities WHERE id = $1",
			params.id
		)
		.fetch_one(&**con)
		.await
		.map_err(ErrorInternalServerError)?;
		let data = Weather::fetch(&client, params.id, &coords)
			.await
			.map_err(ErrorInternalServerError)?;

		data.put(&**con).await.map_err(ErrorInternalServerError)?;

		weather.reserve_exact(1);
		weather.push(data);
	}

	Ok(HttpResponse::Ok().json(weather))
}

pub(super) fn configure(cfg: &mut ServiceConfig) {
	cfg.service(web::resource("/search").route(web::get().to(search)))
		.service(web::resource("/{id}").route(web::get().to(get)))
		.service(web::resource("/{id}/weather").route(web::get().to(weather)));
}
