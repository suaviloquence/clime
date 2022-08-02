DROP TABLE users;

CREATE TABLE users (
	id BLOB NOT NULL PRIMARY KEY,
	username TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL
);

CREATE TABLE authentication (
	username TEXT NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	hash BLOB NOT NULL,
	salt BLOB NOT NULL
);