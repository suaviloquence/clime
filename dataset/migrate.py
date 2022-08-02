import csv
from typing import Iterable, Literal, Text, TypedDict, cast
from enum import Enum
from dataclasses import dataclass
from typing_extensions import Self

CSVConsideration = Literal[
    "Required",
    "Recommended",
    "Considered but not required",
    "Neither required nor recommended",
]


CSVRow = TypedDict(
    "CSVRow",
    {
        # you can get the names using csv.DictReader(fp).fieldnames
        "institution name": str,
        "HD2020.Institution name alias": str | None,
        "HD2020.Street address or post office box": str,
        "HD2020.City location of institution": str,
        # it's... not an abbreviation
        "HD2020.State abbreviation": str,
        # some are in the form xxxxx-xxxx
        "HD2020.ZIP code": str,
        "HD2020.Institution's internet website address": str,
        "HD2020.Admissions office web address": str | None,
        "HD2020.Longitude location of institution": float,
        "HD2020.Latitude location of institution": float,
        "DRVEF2020.Total  enrollment": int | None,
        "DRVEF2020.Undergraduate enrollment": int | None,
        # they are all ints (probably rounded)
        "EF2020D.Student-to-faculty ratio": int,
        # likewise, rounded
        "DRVGR2020.Graduation rate, total cohort": int,
        "IC2020.Open admission policy": Literal["Yes", "No", "Not applicable"] | None,
        "ADM2020.Secondary school GPA": CSVConsideration | None,
        "ADM2020.Secondary school rank": CSVConsideration | None,
        "ADM2020.Secondary school record": CSVConsideration | None,
        "ADM2020.Completion of college-preparatory program": CSVConsideration | None,
        "ADM2020.Recommendations": CSVConsideration | None,
        "ADM2020.Formal demonstration of competencies": CSVConsideration | None,
        "ADM2020.Admission test scores": CSVConsideration | None,
        "ADM2020.Other Test (Wonderlic, WISC-III, etc.)": CSVConsideration | None,
        "ADM2020.TOEFL (Test of English as a Foreign Language": CSVConsideration | None,
        "ADM2020.Applicants total": int | None,
        "ADM2020.Admissions total": int | None,
        "ADM2020.Enrolled total": int | None,
        "DRVADM2020.Admissions yield - total": int | None,
        "ADM2020.Percent of first-time degree/certificate-seeking students submitting SAT scores": int
        | None,
        "ADM2020.Percent of first-time degree/certificate-seeking students submitting ACT scores": int
        | None,
        "ADM2020.SAT Evidence-Based Reading and Writing 25th percentile score": int
        | None,
        "ADM2020.SAT Evidence-Based Reading and Writing 75th percentile score": int
        | None,
        "ADM2020.SAT Math 25th percentile score": int | None,
        "ADM2020.SAT Math 75th percentile score": int | None,
        "ADM2020.ACT Composite 25th percentile score": int | None,
        "ADM2020.ACT Composite 75th percentile score": int | None,
        "ADM2020.ACT English 25th percentile score": int | None,
        "ADM2020.ACT English 75th percentile score": int | None,
        "ADM2020.ACT Math 25th percentile score": int | None,
        "ADM2020.ACT Math 75th percentile score": None,
        "IC2020.Undergraduate application fee": int | None,
        "DRVIC2020.Total price for in-district students living on campus  2020-21": int
        | None,
        "DRVIC2020.Total price for in-state students living on campus 2020-21": int
        | None,
        "DRVIC2020.Total price for out-of-state students living on campus 2020-21": int
        | None,
    },
)


class Consideration(Enum):
    UNSPECIFIED = 0
    REQUIRED = 1
    RECOMMENDED = 2
    CONSIDERED = 3
    NOT_RECOMMENED = 4

    def __conform__(self, protocol):
        import sqlite3

        if protocol is sqlite3.PrepareProtocol:
            return self.value

    @classmethod
    def convert(cls, s: CSVConsideration | None) -> Self:
        if s is None:
            return cls.UNSPECIFIED
        elif s == "Required":
            return cls.REQUIRED
        elif s == "Recommended":
            return cls.RECOMMENDED
        elif s == "Considered but not required":
            return cls.CONSIDERED
        else:
            return cls.NOT_RECOMMENED


# @dataclass
class Row(TypedDict):
    name: str
    aliases: str | None
    street_address: str
    city: str
    state: str
    zip_code: str
    website: str
    admissions_website: str | None
    longitude: float
    latitude: float
    total_enrollment: int | None
    undergrad_enrollment: int | None
    student_to_faculty: int | None
    graduation_rate: int | None
    open_admission: bool | None
    considers_gpa: Consideration
    considers_class_rank: Consideration
    considers_transcript: Consideration
    # who cares
    # considers_college_prep: Consideration
    considers_recommendations: Consideration
    # who cares
    # considers_demonstration: Consideration
    considers_test_scores: Consideration
    considers_toefl: Consideration
    total_applicants: int | None
    total_admissions: int | None
    total_enrolled_applicants: int | None
    admissions_yield: int | None
    submitted_sat: int | None
    submitted_act: int | None
    sat_english_1q: int | None
    sat_english_3q: int | None
    sat_math_1q: int | None
    sat_math_3q: int | None
    act_composite_1q: int | None
    act_composite_3q: int | None
    act_english_1q: int | None
    act_english_3q: int | None
    act_math_1q: int | None
    act_math_3q: int | None
    application_fee: int | None
    price_in_district: int | None
    price_in_state: int | None
    price_out_of_state: int | None


def to_bool_or_none(x: Literal["Yes", "No", "Not applicable"] | None) -> bool | None:
    if x is None or x == "Not applicable":
        return None
    return x == "Yes"


def convert(c: CSVRow) -> Row:
    return Row(
        name=c["institution name"],
        aliases=c["HD2020.Institution name alias"],
        street_address=c["HD2020.Street address or post office box"],
        city=c["HD2020.City location of institution"],
        state=c["HD2020.State abbreviation"],
        zip_code=c["HD2020.ZIP code"],
        website=c["HD2020.Institution's internet website address"],
        admissions_website=c["HD2020.Admissions office web address"],
        longitude=c["HD2020.Longitude location of institution"],
        latitude=c["HD2020.Latitude location of institution"],
        total_enrollment=c["DRVEF2020.Total  enrollment"],
        undergrad_enrollment=c["DRVEF2020.Undergraduate enrollment"],
        student_to_faculty=c["EF2020D.Student-to-faculty ratio"],
        graduation_rate=c["DRVGR2020.Graduation rate, total cohort"],
        open_admission=to_bool_or_none(c["IC2020.Open admission policy"]),
        considers_gpa=Consideration.convert(c["ADM2020.Secondary school GPA"]),
        considers_class_rank=Consideration.convert(c["ADM2020.Secondary school rank"]),
        considers_transcript=Consideration.convert(
            c["ADM2020.Secondary school record"]
        ),
        considers_recommendations=Consideration.convert(c["ADM2020.Recommendations"]),
        considers_test_scores=Consideration.convert(c["ADM2020.Admission test scores"]),
        considers_toefl=Consideration.convert(
            c["ADM2020.TOEFL (Test of English as a Foreign Language"]
        ),
        total_applicants=c["ADM2020.Applicants total"],
        total_admissions=c["ADM2020.Admissions total"],
        total_enrolled_applicants=c["ADM2020.Enrolled total"],
        admissions_yield=c["DRVADM2020.Admissions yield - total"],
        submitted_sat=c[
            "ADM2020.Percent of first-time degree/certificate-seeking students submitting SAT scores"
        ],
        submitted_act=c[
            "ADM2020.Percent of first-time degree/certificate-seeking students submitting ACT scores"
        ],
        sat_english_1q=c[
            "ADM2020.SAT Evidence-Based Reading and Writing 25th percentile score"
        ],
        sat_english_3q=c[
            "ADM2020.SAT Evidence-Based Reading and Writing 75th percentile score"
        ],
        sat_math_1q=c["ADM2020.SAT Math 25th percentile score"],
        sat_math_3q=c["ADM2020.SAT Math 75th percentile score"],
        act_composite_1q=c["ADM2020.ACT Composite 25th percentile score"],
        act_composite_3q=c["ADM2020.ACT Composite 75th percentile score"],
        act_english_1q=c["ADM2020.ACT English 25th percentile score"],
        act_english_3q=c["ADM2020.ACT English 75th percentile score"],
        act_math_1q=c["ADM2020.ACT Math 25th percentile score"],
        act_math_3q=c["ADM2020.ACT Math 75th percentile score"],
        application_fee=c["IC2020.Undergraduate application fee"],
        price_in_district=c[
            "DRVIC2020.Total price for in-district students living on campus  2020-21"
        ],
        price_in_state=c[
            "DRVIC2020.Total price for in-state students living on campus 2020-21"
        ],
        price_out_of_state=c[
            "DRVIC2020.Total price for out-of-state students living on campus 2020-21"
        ],
    )


def read(fp: Iterable[Text]) -> Iterable[Row]:
    reader = csv.DictReader(fp)
    return map(convert, cast(Iterable[CSVRow], reader))


def write_sqlite(url: str, rows: Iterable[Row]):
    import sqlite3

    con = sqlite3.connect(url)

    con.execute(
        """CREATE TABLE IF NOT EXISTS universities (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            name VARCHAR NOT NULL,
            aliases VARCHAR,
            street_address VARCHAR NOT NULL,
            city VARCHAR NOT NULL,
            state VARCHAR NOT NULL,
            zip_code VARCHAR NOT NULL,
            website VARCHAR NOT NULL,
            admissions_website VARCHAR,
            longitude REAL NOT NULL,
            latitude REAL NOT NULL,
            total_enrollment INTEGER,
            undergrad_enrollment INTEGER,
            student_to_faculty INT8,
            graduation_rate INT8,
            open_admission BOOLEAN,
            considers_gpa INT4 NOT NULL,
            considers_class_rank INT4 NOT NULL,
            considers_transcript INT4 NOT NULL,
            considers_recommendations INT4 NOT NULL,
            considers_test_scores INT4 NOT NULL,
            considers_toefl INT4 NOT NULL,
            total_applicants INTEGER,
            total_admissions INTEGER,
            total_enrolled_applicants INTEGER,
            admissions_yield INTEGER,
            submitted_sat INTEGER,
            submitted_act INTEGER,
            sat_english_1q INTEGER,
            sat_english_3q INTEGER,
            sat_math_1q INTEGER,
            sat_math_3q INTEGER,
            act_composite_1q INTEGER,
            act_composite_3q INTEGER,
            act_english_1q INTEGER,
            act_english_3q INTEGER,
            act_math_1q INTEGER,
            act_math_3q INTEGER,
            application_fee INT8,
            price_in_district INTEGER,
            price_in_state INTEGER,
            price_out_of_state INTEGER
        )"""
    )

    # TODO: delete later
    con.execute("DELETE FROM universities")

    con.executemany(
        """INSERT INTO universities (
            name,
            aliases,
            street_address,
            city,
            state,
            zip_code,
            website,
            admissions_website,
            longitude,
            latitude,
            total_enrollment,
            undergrad_enrollment,
            student_to_faculty,
            graduation_rate,
            open_admission,
            considers_gpa,
            considers_class_rank,
            considers_transcript,
            considers_recommendations,
            considers_test_scores,
            considers_toefl,
            total_applicants,
            total_admissions,
            total_enrolled_applicants,
            admissions_yield,
            submitted_sat,
            submitted_act,
            sat_english_1q,
            sat_english_3q,
            sat_math_1q,
            sat_math_3q,
            act_composite_1q,
            act_composite_3q,
            act_english_1q,
            act_english_3q,
            act_math_1q,
            act_math_3q,
            application_fee,
            price_in_district,
            price_in_state,
            price_out_of_state
    ) VALUES (
            :name,
            :aliases,
            :street_address,
            :city,
            :state,
            :zip_code,
            :website,
            :admissions_website,
            :longitude,
            :latitude,
            :total_enrollment,
            :undergrad_enrollment,
            :student_to_faculty,
            :graduation_rate,
            :open_admission,
            :considers_gpa,
            :considers_class_rank,
            :considers_transcript,
            :considers_recommendations,
            :considers_test_scores,
            :considers_toefl,
            :total_applicants,
            :total_admissions,
            :total_enrolled_applicants,
            :admissions_yield,
            :submitted_sat,
            :submitted_act,
            :sat_english_1q,
            :sat_english_3q,
            :sat_math_1q,
            :sat_math_3q,
            :act_composite_1q,
            :act_composite_3q,
            :act_english_1q,
            :act_english_3q,
            :act_math_1q,
            :act_math_3q,
            :application_fee,
            :price_in_district,
            :price_in_state,
            :price_out_of_state
    )""",
        rows,
    )
    con.commit()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="migrate dataset csv to a database")

    parser.add_argument("file", help="the CSV to import", type=argparse.FileType("r"))
    parser.add_argument(
        "--database",
        help="type of database (currently supported: sqlite)",
        default="sqlite",
        dest="database",
    )
    parser.add_argument("database_url", help="the url/filename of the database to open")

    args = parser.parse_args()

    rows = read(args.file)

    if args.database == "sqlite":
        write_sqlite(args.database_url, rows)
