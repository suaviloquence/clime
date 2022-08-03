use serde::Serialize;

use crate::db::Pool;

use super::Load;

// #[derive(Debug, Type)]
// #[repr(u8)]
// pub enum Consideration {
// 	Unspecified = 0,
// 	Required = 1,
// 	Recommended = 2,
// 	Considered = 3,
// 	NotRecommended = 4,
// }
pub type Consideration = i32;

#[derive(Debug, Serialize)]
pub struct University {
	pub id: i64,
	pub name: String,
	pub aliases: Option<String>,
	pub street_address: String,
	pub city: String,
	pub state: String,
	pub zip_code: String,
	pub website: String,
	pub admissions_website: Option<String>,
	pub longitude: f64,
	pub latitude: f64,
	pub total_enrollment: Option<i64>,
	pub undergrad_enrollment: Option<i64>,
	pub student_to_faculty: Option<i64>,
	pub graduation_rate: Option<i64>,
	pub open_admission: Option<bool>,
	pub considers_gpa: Consideration,
	pub considers_class_rank: Consideration,
	pub considers_transcript: Consideration,
	pub considers_recommendations: Consideration,
	pub considers_test_scores: Consideration,
	pub considers_toefl: Consideration,
	pub total_applicants: Option<i64>,
	pub total_admissions: Option<i64>,
	pub total_enrolled_applicants: Option<i64>,
	pub admissions_yield: Option<i64>,
	pub submitted_sat: Option<i64>,
	pub submitted_act: Option<i64>,
	pub sat_english_1q: Option<i64>,
	pub sat_english_3q: Option<i64>,
	pub sat_math_1q: Option<i64>,
	pub sat_math_3q: Option<i64>,
	pub act_composite_1q: Option<i64>,
	pub act_composite_3q: Option<i64>,
	pub act_english_1q: Option<i64>,
	pub act_english_3q: Option<i64>,
	pub act_math_1q: Option<i64>,
	pub act_math_3q: Option<i64>,
	pub application_fee: Option<i64>,
	pub price_in_district: Option<i64>,
	pub price_in_state: Option<i64>,
	pub price_out_of_state: Option<i64>,
}

impl Load for University {
	type Connection = Pool;
	type ID = i64;
	type Error = sqlx::Error;

	fn load(
		con: Self::Connection,
		id: Self::ID,
	) -> futures_util::future::BoxFuture<'static, Result<Option<Self>, Self::Error>> {
		Box::pin(async move {
			sqlx::query_as!(Self, "SELECT * FROM universities WHERE id = $1", id)
				.fetch_optional(&con)
				.await
		})
	}

	// sqlx::query_as!(Self, r#"SELECT * FROM universities WHERE id = $1"#, id)
	// 	.fetch_optional(con)
	// 	.await
}
