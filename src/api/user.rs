use std::sync::Arc;

use actix_web::{
	dev::Service,
	error::{ErrorBadRequest, ErrorInternalServerError, ErrorNotFound, ErrorUnauthorized},
	http::header::AUTHORIZATION,
	web::{self, ServiceConfig},
	HttpMessage, HttpRequest, HttpResponse,
};

use crate::{
	db::Pool,
	models::{
		user::{Metadata, User},
		Load,
	},
};
use chrono::{Duration, Utc};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::Response;

const ALGORITHM: Algorithm = Algorithm::HS256;

lazy_static! {
	static ref VALIDATION: Validation = Validation::new(ALGORITHM);
}

lazy_static! {
	static ref HEADER: Header = Header::new(ALGORITHM);
}

#[derive(Debug, Deserialize, Serialize)]
struct Claims {
	#[allow(unused)] // used by jsonwebtoken
	exp: usize,
	uid: Uuid,
}

fn get_uid(req: &HttpRequest) -> Uuid {
	*req.extensions().get().unwrap()
}

async fn get(con: web::Data<Pool>, req: HttpRequest) -> Response {
	let uid = get_uid(&req);

	User::load(Arc::clone(&con), uid)
		.await
		.map_err(ErrorInternalServerError)
		.and_then(|user| user.ok_or_else(|| ErrorNotFound("user not found")))
		.map(|user| HttpResponse::Ok().json(user))
}

#[derive(Debug, Deserialize)]
struct Signup {
	metadata: Metadata,
}

#[derive(Debug, Serialize)]
struct JwtResponse {
	jwt: String,
	exp: usize,
}

fn create_jwt(uid: Uuid, key: &EncodingKey) -> Response {
	let exp = (Utc::now() + Duration::minutes(3)).timestamp() as usize;

	jsonwebtoken::encode(&HEADER, &Claims { exp, uid }, key)
		.map_err(ErrorInternalServerError)
		.map(|jwt| HttpResponse::Ok().json(JwtResponse { jwt, exp }))
}

async fn create(
	con: web::Data<Pool>,
	key: web::Data<EncodingKey>,
	data: web::Json<Signup>,
) -> Response {
	User::create(Arc::clone(&con), data.0.metadata)
		.await
		.map_err(ErrorInternalServerError)
		.and_then(|user| create_jwt(user.id, &key))
}

#[derive(Debug, Deserialize)]
struct Login {
	id: Uuid,
}

async fn login(
	con: web::Data<Pool>,
	key: web::Data<EncodingKey>,
	data: web::Json<Login>,
) -> Response {
	// TODO check auth
	User::load(Arc::clone(&con), data.0.id)
		.await
		.map_err(ErrorInternalServerError)
		.and_then(|option| option.ok_or_else(|| ErrorNotFound("user not found")))
		.and_then(|user| create_jwt(user.id, &key))
}

#[derive(Debug, Deserialize)]
struct UpdateUniv {
	id: i64,
}

async fn get_universities(con: web::Data<Pool>, req: HttpRequest) -> Response {
	let uid = get_uid(&req);

	let user = User::load(Arc::clone(&con), uid)
		.await
		.map_err(ErrorInternalServerError)?
		.ok_or_else(|| ErrorUnauthorized("user not found"))?;

	let universities = user
		.universities
		.load(Arc::clone(&con))
		.await
		.map_err(ErrorInternalServerError)?
		.ok_or_else(|| ErrorInternalServerError("university not found"))?;

	Ok(HttpResponse::Ok().json(universities))
}

async fn add_university(
	con: web::Data<Pool>,
	req: HttpRequest,
	data: web::Json<UpdateUniv>,
) -> Response {
	let uid = get_uid(&req);

	// TODO: check if user exists and hasn't already subscribed to university
	// and university exists

	sqlx::query!(
		"INSERT INTO get_weather (university_id, user_id) VALUES ($1, $2)",
		data.id,
		uid
	)
	.execute(con.as_ref())
	.await
	.map_err(ErrorInternalServerError)
	.map(|x| HttpResponse::Ok().body(format!("{:?}", x)))
}

async fn delete_university(
	con: web::Data<Pool>,
	req: HttpRequest,
	data: web::Json<UpdateUniv>,
) -> Response {
	let uid = get_uid(&req);

	sqlx::query!(
		"DELETE FROM get_weather WHERE (university_id, user_id) = ($1, $2)",
		data.id,
		uid
	)
	.execute(con.as_ref())
	.await
	.map_err(ErrorInternalServerError)
	.map(|_| HttpResponse::Ok().body(()))
}

pub(super) fn configure(cfg: &mut ServiceConfig) {
	cfg.service(web::resource("/create").route(web::post().to(create)))
		.service(web::resource("/login").route(web::post().to(login)))
		.service(
			web::scope("/me")
				.wrap_fn(|req, srv| {
					let key = req.app_data::<web::Data<DecodingKey>>().unwrap();
					let err = req
						.headers()
						.get(AUTHORIZATION)
						.ok_or_else(|| ErrorBadRequest("missing Authorization header"))
						.and_then(|auth| auth.to_str().map_err(ErrorBadRequest))
						.and_then(|auth| {
							auth.strip_prefix("Bearer ").ok_or_else(|| {
								ErrorBadRequest("missing Bearer in authorization header")
							})
						})
						.and_then(|token| {
							jsonwebtoken::decode::<Claims>(token, key, &VALIDATION)
								.map_err(ErrorUnauthorized)
						})
						.map(|jwt| {
							req.extensions_mut().insert(jwt.claims.uid);
						});
					let fut = srv.call(req);

					async move {
						err?;
						fut.await
					}
				})
				.service(web::resource("").route(web::get().to(get)))
				.service(
					web::resource("/universities")
						.route(web::get().to(get_universities))
						.route(web::put().to(add_university))
						.route(web::delete().to(delete_university)),
				),
		);
}
