use actix_web::{
	dev::Service,
	error::{ErrorBadRequest, ErrorInternalServerError, ErrorNotFound, ErrorUnauthorized},
	http::header::AUTHORIZATION,
	web::{self, ServiceConfig},
	HttpMessage, HttpRequest, HttpResponse, Responder, Result,
};
use rand::Rng;

use crate::{
	db::Pool,
	models::{
		user::{Authentication, Metadata, User},
		Load,
	},
};
use chrono::{Duration, Utc};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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

async fn get(con: web::Data<Pool>, req: HttpRequest) -> Result<impl Responder> {
	let uid = get_uid(&req);

	User::load(Pool::clone(&con), uid)
		.await
		.map_err(ErrorInternalServerError)
		.and_then(|user| user.ok_or_else(|| ErrorUnauthorized("user not found")))
		.map(|user| HttpResponse::Ok().json(user))
}

async fn update(
	con: web::Data<Pool>,
	req: HttpRequest,
	metadata: web::Json<Metadata>,
) -> Result<impl Responder> {
	if metadata.username.is_empty() {
		return Err(ErrorBadRequest("username is required"));
	}

	let uid = get_uid(&req);
	let mut user = User::load(Pool::clone(&con), uid)
		.await
		.map_err(ErrorInternalServerError)
		.and_then(|opt| opt.ok_or_else(|| ErrorUnauthorized("user not found")))?;

	if user.metadata.username != metadata.username {
		let existing = sqlx::query!(
			"SELECT username FROM users WHERE username = $1",
			metadata.username
		)
		.fetch_optional(con.as_ref())
		.await
		.map_err(ErrorInternalServerError)?;

		if existing.is_some() {
			return Err(ErrorBadRequest("user already exists"));
		}
	}

	user.metadata = metadata.0;
	user.update(Pool::clone(&con))
		.await
		.map_err(ErrorInternalServerError)
		.map(|_| HttpResponse::Ok().body(()))
}

#[derive(Debug, Deserialize)]
struct Signup {
	metadata: Metadata,
	password: String,
}

#[derive(Debug, Serialize)]
struct JwtResponse {
	jwt: String,
	exp: usize,
}

const JWT_DURATION: Duration = Duration::days(7);

fn create_jwt(uid: Uuid, key: &EncodingKey) -> Result<impl Responder> {
	let exp = (Utc::now() + JWT_DURATION).timestamp() as usize;

	jsonwebtoken::encode(&HEADER, &Claims { exp, uid }, key)
		.map_err(ErrorInternalServerError)
		.map(|jwt| HttpResponse::Ok().json(JwtResponse { jwt, exp }))
}

async fn create(
	con: web::Data<Pool>,
	key: web::Data<EncodingKey>,
	config: web::Data<argon2::Config<'static>>,
	data: web::Json<Signup>,
) -> Result<impl Responder> {
	if data.metadata.username.is_empty() || data.metadata.name.is_empty() || data.password.len() < 8
	{
		return Err(ErrorBadRequest("username, name must be at least one character and password mut be at least 8 characters"));
	}

	sqlx::query!(
		"SELECT username FROM users WHERE username = $1",
		data.metadata.username
	)
	.fetch_optional(con.as_ref())
	.await
	.map_err(ErrorInternalServerError)
	.and_then(|opt| {
		if opt.is_none() {
			Ok(())
		} else {
			Err(ErrorBadRequest("user already exists"))
		}
	})?;

	let user = User::create(Pool::clone(&con), data.0.metadata)
		.await
		.map_err(ErrorInternalServerError)?;

	let mut salt = [0u8; 16];

	rand::thread_rng().fill(&mut salt);

	let salt = salt.to_vec();

	let hash = argon2::hash_raw(data.0.password.as_bytes(), &salt, &config)
		.map_err(ErrorInternalServerError)?;

	Authentication {
		username: user.metadata.username.clone(),
		hash,
		salt,
	}
	.put(Pool::clone(&con))
	.await
	.map_err(ErrorInternalServerError)?;

	create_jwt(user.id, &key)
}

#[derive(Debug, Deserialize)]
struct Login {
	username: String,
	password: String,
}

async fn login(
	con: web::Data<Pool>,
	key: web::Data<EncodingKey>,
	config: web::Data<argon2::Config<'static>>,
	data: web::Json<Login>,
) -> Result<impl Responder> {
	if data.username.is_empty() || data.password.is_empty() {
		return Err(ErrorBadRequest("username and password cannot be empty"));
	}

	Authentication::load(Pool::clone(&con), data.0.username.clone())
		.await
		.map_err(ErrorInternalServerError)
		.and_then(|opt| opt.ok_or_else(|| ErrorNotFound("user not found")))
		.and_then(|auth| {
			argon2::verify_raw(data.password.as_bytes(), &auth.salt, &auth.hash, &config)
				.map_err(ErrorInternalServerError)
		})
		.and_then(|val| {
			if val {
				Ok(async move {
					sqlx::query!(
						r#"SELECT id as "id: Uuid" FROM users WHERE username = $1"#,
						data.0.username
					)
					.fetch_one(con.as_ref())
					.await
					.map_err(ErrorInternalServerError)
				})
			} else {
				Err(ErrorUnauthorized("invalid password"))
			}
		})?
		.await
		.and_then(|row| create_jwt(row.id, &key))
}

#[derive(Debug, Deserialize)]
struct UpdateUniv {
	id: i64,
}

async fn get_universities(con: web::Data<Pool>, req: HttpRequest) -> Result<impl Responder> {
	let uid = get_uid(&req);

	let user = User::load(Pool::clone(&con), uid)
		.await
		.map_err(ErrorInternalServerError)?
		.ok_or_else(|| ErrorUnauthorized("user not found"))?;

	let universities = user
		.universities
		.load(Pool::clone(&con))
		.await
		.map_err(ErrorInternalServerError)?
		.ok_or_else(|| ErrorInternalServerError("university not found"))?;

	Ok(HttpResponse::Ok().json(universities))
}

async fn add_university(
	con: web::Data<Pool>,
	req: HttpRequest,
	data: web::Json<UpdateUniv>,
) -> Result<impl Responder> {
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
) -> Result<impl Responder> {
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

#[derive(Debug, Deserialize)]
struct UsernameQuery {
	username: String,
}

async fn username_available(
	con: web::Data<Pool>,
	query: web::Query<UsernameQuery>,
) -> Result<impl Responder> {
	if query.username.is_empty() {
		return Err(ErrorBadRequest("username cannot be empty"));
	}

	sqlx::query!(
		"SELECT username FROM users WHERE username = $1",
		query.username
	)
	.fetch_optional(con.as_ref())
	.await
	.map_err(ErrorInternalServerError)
	.map(|opt| HttpResponse::Ok().json(opt.is_none()))
}

pub(super) fn configure(cfg: &mut ServiceConfig) {
	cfg.service(web::resource("/create").route(web::post().to(create)))
		.service(web::resource("/login").route(web::post().to(login)))
		.service(web::resource("/check").route(web::get().to(username_available)))
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
				.service(
					web::resource("")
						.route(web::get().to(get))
						.route(web::put().to(update)),
				)
				.service(
					web::resource("/universities")
						.route(web::get().to(get_universities))
						.route(web::put().to(add_university))
						.route(web::delete().to(delete_university)),
				),
		);
}
