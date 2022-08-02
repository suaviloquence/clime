DROP TABLE get_weather;
DROP TABLE users;

CREATE TABLE users (
	id BLOB NOT NULL PRIMARY KEY,
	name TEXT NOT NULL
);


CREATE TABLE get_weather ( 
	university_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
	user_id BLOB NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	PRIMARY KEY (university_id, user_id)
);