DROP TABLE authentication;

CREATE TABLE authentication (
	username TEXT NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	hash BLOB NOT NULL,
	salt BLOB NOT NULL
);