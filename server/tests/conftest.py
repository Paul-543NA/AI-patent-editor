import pytest
from fastapi.testclient import TestClient

from app.__main__ import app


@pytest.fixture(scope="module")
def client():
    """
    FastAPI TestClient that runs the full app lifespan (creates tables + seeds data)
    for each test, giving each test a fresh in-memory SQLite database.
    """
    with TestClient(app) as c:
        yield c
