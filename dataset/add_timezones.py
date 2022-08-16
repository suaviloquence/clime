import requests
from dataclasses import dataclass
import logging

__version__ = "0.1.0"

logger = logging.getLogger(__name__)


@dataclass
class Row:
    id: int
    latitude: float
    longitude: float


API_ENDPOINT = "http://api.geonames.org/timezoneJSON?lat=%(latitude)f&lng=%(longitude)f&username=%(username)s"


def get_timezone(session: requests.Session, username: str, row: Row) -> str:
    data = session.get(
        API_ENDPOINT
        % {"username": username, "latitude": row.latitude, "longitude": row.longitude}
    ).json()

    logger.debug(data)

    return data["timezoneId"]


def migrate_sqlite3(
    database_url: str, username: str, create_column: bool, start_at: int = -1
):
    import sqlite3

    with sqlite3.connect(database_url) as con:
        cur = con.cursor()

        if create_column:
            cur.execute(
                "ALTER TABLE universities ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles'",
            )

        rows = cur.execute(
            "SELECT id, latitude, longitude FROM universities WHERE id > ?", [start_at]
        ).fetchall()

        session = requests.Session()
        session.headers.setdefault("User-Agent", f"clime {__name__} v{__version__}")

        for row in rows:
            row = Row(*row)
            logger.info(f"Getting row {row.id}")
            tz = "America/Los_Angeles"
            try:
                tz = get_timezone(session, username, row)
                logger.info(f"Got tz for row: {tz}")
            except Exception as e:
                logger.error("Error with timezone", exc_info=e)
            cur.execute(
                "UPDATE universities SET timezone = ? WHERE id = ?", [tz, row.id]
            )

        con.commit()


if __name__ == "__main__":
    import argparse

    logging.basicConfig(
        format="[%(name)s] %(levelname)s: %(message)s", level=logging.DEBUG
    )

    parser = argparse.ArgumentParser(description="add timezone column to database")

    parser.add_argument(
        "--create-column",
        action="store_true",
        help="add column to database",
        dest="create_column",
    )

    parser.add_argument(
        "--start-at",
        help="university ID to start from",
        dest="start_at",
        type=int,
        default=0,
    )

    parser.add_argument(
        "--database",
        help="type of database (currently supported: sqlite)",
        default="sqlite",
        dest="database",
    )

    parser.add_argument("database_url", help="the url/filename of the database to open")
    parser.add_argument("username", help="geonames.org username")

    args = parser.parse_args()

    if args.database == "sqlite":
        migrate_sqlite3(
            args.database_url, args.username, args.create_column, args.start_at
        )
