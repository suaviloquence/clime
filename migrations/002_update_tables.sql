DROP TABLE weather;

CREATE TABLE weather (
	university_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
	time DATETIME NOT NULL,
	temperature REAL NOT NULL,
	feels_like REAL NOT NULL,
	weather_type INTEGER NOT NULL,
	weather_description VARCHAR NOT NULL,
	humidity REAL NOT NULL,
	pressure REAL NOT NULL,
	wind_speed REAL NOT NULL,
	cloudiness REAL NOT NULL,
	PRIMARY KEY (university_id, time)
);

CREATE TABLE users (
	id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	name VARCHAR NOT NULL
);

DROP TABLE get_weather;

CREATE TABLE get_weather ( 
	university_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	PRIMARY KEY (university_id, user_id)
);