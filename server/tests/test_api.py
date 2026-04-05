"""
Tests for FastAPI endpoints. Uses a fresh in-memory SQLite database per test
(via the app's lifespan, which seeds two sample documents on startup).
"""
import pytest


class TestHealthCheck:
    def test_root_returns_running(self, client):
        response = client.get("/")
        assert response.status_code == 200
        assert "running" in response.json()["message"]


class TestListDocuments:
    def test_returns_list(self, client):
        response = client.get("/documents")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_returns_seeded_documents(self, client):
        response = client.get("/documents")
        ids = [doc["id"] for doc in response.json()]
        assert 1 in ids
        assert 2 in ids

    def test_documents_have_title(self, client):
        response = client.get("/documents")
        for doc in response.json():
            assert "title" in doc
            assert doc["title"] is not None


class TestGetDocument:
    def test_returns_seeded_document(self, client):
        response = client.get("/document/1")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1
        assert data["content"] is not None

    def test_returns_404_for_missing_document(self, client):
        response = client.get("/document/9999")
        assert response.status_code == 404


class TestVersioning:
    def test_create_version_increments_version_number(self, client):
        # Get existing versions
        versions_before = client.get("/document/1/versions").json()
        max_version_before = max(v["version_number"] for v in versions_before)

        # Create a new version
        response = client.post(
            "/document/1/version",
            json={"content": "<p>New version content</p>"}
        )
        assert response.status_code == 200
        new_version = response.json()
        assert new_version["version_number"] == max_version_before + 1

    def test_cannot_delete_current_version(self, client):
        # Get the document to find current_version_id
        doc = client.get("/document/2").json()
        current_version_id = doc["current_version_id"]

        response = client.delete(f"/document/2/version/{current_version_id}")
        assert response.status_code == 400
        assert "current version" in response.json()["detail"].lower()

    def test_cannot_delete_last_version(self, client):
        # Document 2 starts with 1 version; we need to ensure we only have 1.
        versions = client.get("/document/2/versions").json()
        assert len(versions) == 1

        version_id = versions[0]["id"]
        # Switch away from current version is impossible without another version,
        # so this should fail with "cannot delete current version" (also 400).
        response = client.delete(f"/document/2/version/{version_id}")
        assert response.status_code == 400

    def test_switch_version_updates_current_version_id(self, client):
        # Create a second version on document 1
        new_v = client.post(
            "/document/1/version",
            json={"content": "<p>Alternate version</p>"}
        ).json()
        new_version_id = new_v["id"]

        # Switch to new version
        response = client.post(f"/document/1/switch-version/{new_version_id}")
        assert response.status_code == 200
        assert response.json()["current_version_id"] == new_version_id

    def test_get_versions_returns_all_versions(self, client):
        response = client.get("/document/1/versions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) >= 1
