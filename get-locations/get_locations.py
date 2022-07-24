from requests import Session

API_TEMPLATE = "https://overpass-api.de/api/interpreter/%s"


class Client:
    session: Session

    def __init__(self) -> None:
        super().__init__()
        session = Session()

    def get_guy(self, name: str):
        self.session.get(API_TEMPLATE % "")
