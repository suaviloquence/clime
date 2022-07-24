use reqwest::RequestBuilder;

use crate::{Client, Units};

#[derive(Debug, Default)]
pub struct Options {
	pub units: Units,
	pub lang: Language,
}

#[derive(Debug)]
pub enum Language {
	Afrikaans,
	Albanian,
	Arabic,
	Azerbaijani,
	Bulgarian,
	Catalan,
	Czech,
	Danish,
	German,
	Greek,
	English,
	Basque,
	Persian,
	Farsi,
	Finnish,
	French,
	Galician,
	Hebrew,
	Hindi,
	Hungarian,
	Indonesian,
	Italian,
	Japanese,
	Korean,
	Latvian,
	Lithuanian,
	Macedonian,
	Norwegian,
	Dutch,
	Polish,
	Portuguese,
	PortuguesBrazil,
	Romanian,
	Russian,
	Swedish,
	Slovak,
	Slovenian,
	Spanish,
	Serbian,
	Thai,
	Turkish,
	Ukranian,
	Vietnamese,
	ChineseSimplified,
	ChineseTraditional,
	Zulu,
}

impl From<&Language> for &'static str {
	fn from(lang: &Language) -> Self {
		match lang {
			Language::Afrikaans => "af",
			Language::Albanian => "al",
			Language::Arabic => "ar",
			Language::Azerbaijani => "az",
			Language::Bulgarian => "bg",
			Language::Catalan => "ca",
			Language::Czech => "cz",
			Language::Danish => "da",
			Language::German => "de",
			Language::Greek => "el",
			Language::English => "en",
			Language::Basque => "eu",
			Language::Persian => "fa",
			Language::Farsi => "fa",
			Language::Finnish => "fi",
			Language::French => "fr",
			Language::Galician => "gl",
			Language::Hebrew => "he",
			Language::Hindi => "hi",
			Language::Hungarian => "hu",
			Language::Indonesian => "id",
			Language::Italian => "it",
			Language::Japanese => "ja",
			Language::Korean => "kr",
			Language::Latvian => "la",
			Language::Lithuanian => "lt",
			Language::Macedonian => "mk",
			Language::Norwegian => "no",
			Language::Dutch => "nl",
			Language::Polish => "pl",
			Language::Portuguese => "pt",
			Language::PortuguesBrazil => "pt_br",
			Language::Romanian => "ro",
			Language::Russian => "ru",
			Language::Swedish => "se",
			Language::Slovak => "sk",
			Language::Slovenian => "sl",
			Language::Spanish => "es",
			Language::Serbian => "sr",
			Language::Thai => "th",
			Language::Turkish => "tr",
			Language::Ukranian => "ua",
			Language::Vietnamese => "vi",
			Language::ChineseSimplified => "zh_cn",
			Language::ChineseTraditional => "zh_tw",
			Language::Zulu => "zu",
		}
	}
}

impl Default for Language {
	fn default() -> Self {
		Self::English
	}
}

impl Client {
	pub(crate) fn add_options(&self, builder: RequestBuilder) -> RequestBuilder {
		builder.query::<[(_, &str)]>(&[
			("lang", From::from(&self.options.lang)),
			("units", From::from(&self.options.units)),
		])
	}
}
