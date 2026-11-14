"""Smoke test: the API boots and the health endpoint responds (db may be absent locally)."""

from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_responds():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"ok", "degraded"}
    assert body["database"] in {"up", "down"}
