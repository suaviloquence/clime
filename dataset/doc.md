- get dataset from [IPEDS](https://nces.ed.gov/ipeds/use-the-data/download-access-database), unzip
- use `mdbtools` to convert to csv
  - ~~export the HD2020 table (directory information) to csv: `mdb-export IPEDS202021.accdb HD2020 > directory.csv`~~
  - export the HD2020 table (directory information) to sqlite database
    1. `FILE=IPEDS202021.accdb; TABLE=HD2020`
    2. `mdb-schema "$FILE" --table "$TABLE" sqlite | sqlite3 db.sqlite3`
    3. `mdb-export "$FILE" "$TABLE" --insert sqlite | sqlite3 db.sqlite3`

# or

- get dataset from [IPEDS](https://nces.ed.gov/ipeds/datacenter/CDSPreview.aspx)
  1.  select by group - all institutions, all public or nonprofit 4+/4/2 years
  2.  select the following variables:
      - Institutional Characteristics/Directory information, institution classifications, and response status information
        - Directory information and response status
          - Institution (entity) name
          - Institution name alias
          - Street address or post office box
          - City location of institution
          - State abbreviation
          - ZIP code
          - Institution's internet website address
          - Admissions office web address
          - Longitude location of institution
          - Latitude location of institution
      - Fall Enrollment/Frequently used enrollment variables: Fall 2020
        - Frequently used fall enrollment variables
          - Total enrollment
          - Undergraduate enrollment
      - Fall Enrollment/Student-to-faculty ratio: Fall 2020
        - Student-to-faculty ratio
          - Student-to-faculty ratio
      - Graduation Rates/Frequently used graduation rates
        - Frequently used graduation rates
          - Graduation rate, total cohort
      - Admissions and Test Scores/Admission considerations, applications, admissions, enrollees and test scores
        - Admission considerations
          - Open admission policy
          - Secondary school GPA
          - Secondary school rank
          - Secondary school record
          - Completion of college-preparatory program
          - Recommendations
          - Formal demonstration of competencies
          - Admission test scores
          - Other Test (Wonderlic, WISC-III, etc.)
          - TOEFL (Test of English as a Foreign Language
        - Number of applications, admissions and enrollees
          - Applicants total
          - Admissions total
          - Enrolled total
          - Admissions yield - total
        - SAT and ACT test scores
          - Percent of first-time degree/certificate-seeking students submitting SAT scores
          - Percent of first-time degree/certificate-seeking students submitting ACT scores
          - SAT Evidence-Based Reading and Writing 25th percentile score
          - SAT Evidence-Based Reading and Writing 75th percentile score
          - SAT Math 25th percentile score
          - SAT Math 75th percentile score
          - ACT Composite 25th percentile score
          - ACT Composite 75th percentile score
          - ACT English 25th percentile score
          - ACT English 75th percentile score
          - ACT Math 25th percentile score
          - ACT Math 75th percentile score
      - Institutional Characteristics/Student charges
        - Application fees, room and board charges, tuition plans and other student charge questions
          - Undergraduate application fee
        - Price of attendance of full-time, first-time undergraduate students (charges for full academic year)
          - Total price for in-district students living on campus 2020-21
          - Total price for in-state students living on campus 2020-21
          - Total price for out-of-state students living on campus 2020-21
  3.  download as csv, unzip
  4.  migrate using migrate.py
- saved session: Guest_491085889152
