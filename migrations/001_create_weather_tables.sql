CREATE TABLE weather (
	university_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
	hour INTEGER NOT NULL,
	temperature REAL NOT NULL,
	PRIMARY KEY (university_id, hour)
);

CREATE TABLE get_weather (
	university_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE PRIMARY KEY
);