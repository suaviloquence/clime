// enum Consideration {
//   Unspecified,
//   Required,
//   Recommended,
//   Considered,
//   NotRecommended,
// }
export type Consideration = 0 | 1 | 2 | 3 | 4;

export interface University {
  id: number;
  name: string;
  aliases?: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  website: string;
  admissions_website?: string;
  longitude: number;
  latitude: number;
  total_enrollment?: number;
  undergrad_enrollment?: number;
  student_to_faculty?: number;
  graduation_rate?: number;
  open_admission?: bool;
  considers_gpa: Consideration;
  considers_class_rank: Consideration;
  considers_transcript: Consideration;
  considers_recommendations: Consideration;
  considers_test_scores: Consideration;
  considers_toefl: Consideration;
  total_applicants?: number;
  total_admissions?: number;
  total_enrolled_applicants?: number;
  admissions_yield?: number;
  submitted_sat?: number;
  submitted_act?: number;
  sat_english_1q?: number;
  sat_english_3q?: number;
  sat_math_1q?: number;
  sat_math_3q?: number;
  act_composite_1q?: number;
  act_composite_3q?: number;
  act_english_1q?: number;
  act_english_3q?: number;
  act_math_1q?: number;
  act_math_3q?: number;
  application_fee?: number;
  price_in_district?: number;
  price_in_state?: number;
  price_out_of_state?: number;
  timezone: string;
}

export interface Weather {
  university_id: number;
  time: number;
  temperature: number;
  feels_like: number;
  weather_type: number;
  weather_description: string;
  humidity: number;
  pressure: number;
  wind_speed: number;
  cloudiness: number;
}

export interface User {
  id: string;
  metadata: UserMetadata;
  universities: number[];
}

export interface UserMetadata {
  name: string;
  username: string;
  units: "imperial" | "metric";
  timezone?: number;
}

export interface JwtInfo {
  jwt: string;
  exp: number;
}

export interface Forecast {
  university_id: number;
  time: number;
  fetched_at: number;
  temperature: number;
  feels_like: number;
  weather_id: number;
  weather_description: string;
  humidity: number;
  pressure: number;
  wind_speed: number;
  precipitation_chance: number;
}
