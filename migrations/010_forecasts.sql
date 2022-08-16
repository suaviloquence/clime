CREATE TABLE forecasts (
	university_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
	time DATETIME NOT NULL,
	fetched_at DATETIME NOT NULL,
	temperature REAL NOT NULL,
	feels_like REAL NOT NULL,
	weather_id INTEGER NOT NULL,
	weather_description TEXT NOT NULL,
	humidity REAL NOT NULL,
	pressure REAL NOT NULL,
	wind_speed REAL NOT NULL,
	precipitation_chance REAL NOT NULL,
	PRIMARY KEY (university_id, time)
);