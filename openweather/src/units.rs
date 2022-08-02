use serde::Deserialize;

#[derive(Debug, Clone, Copy)]
pub enum Units {
	/// Standard units.
	/// Unit of temperature: Kelvin
	Standard,
	/// Metric units.
	/// Unit of temperature: Celsius
	Metric,
	/// Imperial units
	/// Unit of temperature: Fahrenheit
	Imperial,
}

impl Default for Units {
	fn default() -> Self {
		Self::Standard
	}
}

impl From<&Units> for &'static str {
	fn from(units: &Units) -> Self {
		match units {
			Units::Standard => "standard",
			Units::Metric => "metric",
			Units::Imperial => "imperial",
		}
	}
}

macro_rules! unit_type {
	{
		$(#[$meta:meta])*
		$name: ident($T: ident)
	} => {
		$(#[$meta])*
		#[repr(transparent)]
		#[derive(Debug, Deserialize, PartialEq, PartialOrd, Clone, Copy)]
		#[serde(transparent)]
		pub struct $name(pub $T);

		impl From<$T> for $name {
			fn from(t: $T) -> Self {
				Self(t)
			}
		}

		impl From<$name> for $T {
			fn from(outer: $name) -> Self {
				outer.0
			}
		}

		impl std::ops::Deref for $name {
			type Target = $T;

			fn deref(&self) -> &Self::Target {
				&self.0
			}
		}

		impl std::ops::DerefMut for $name {
			fn deref_mut(&mut self) -> &mut Self::Target {
				&mut self.0
			}
		}
	};
}

unit_type! {
	/// Measures temperature
	/// # Units
	/// - [`Units::Standard`] => Kelvin
	/// - [`Units::Metric`] => °Celsius
	/// - [`Units::Imperial`] => °Fahrenheit
	Temperature(f64)
}

unit_type! {
	/// Measures speed
	/// # Units
	/// - [`Units::Standard`] => meters/second
	/// - [`Units::Metric`] => meters/second
	/// - [`Units::Imperial`] => miles/hour
	Speed(f64)
}
