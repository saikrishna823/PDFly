import pytest
from fastapi.testclient import TestClient

from app.config.settings import Settings
from tests.conftest import CRASH_ENDPOINT, SAMPLE_PDF, UPLOAD_ENDPOINT, build_app

ORIGIN = {"Origin": "http://localhost:4200"}


def _upload(client: TestClient, data: bytes = SAMPLE_PDF, filename: str = "report.pdf", headers: dict | None = None):
    return client.post(UPLOAD_ENDPOINT, files={"file": (filename, data, "application/pdf")}, headers=headers)


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "0.1.0"}


def test_valid_upload_returns_downloadable_file(client: TestClient) -> None:
    response = _upload(client)

    assert response.status_code == 200
    assert response.content == SAMPLE_PDF
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "no-store"
    assert 'filename="report-copy.pdf"' in response.headers["content-disposition"]


def test_filename_is_sanitised(client: TestClient) -> None:
    response = _upload(client, filename='..\\..\\etc/pass"wd.pdf')
    assert response.status_code == 200
    disposition = response.headers["content-disposition"]
    assert ".." not in disposition and "/" not in disposition.split("filename*")[0]
    ascii_name = disposition.split('filename="')[1].split('"')[0]
    assert ascii_name.startswith("pass") and ascii_name.endswith("-copy.pdf")


def test_missing_file_is_invalid_request(client: TestClient) -> None:
    response = client.post(UPLOAD_ENDPOINT)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


def test_wrong_extension_is_rejected(client: TestClient) -> None:
    response = _upload(client, filename="report.exe")
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_file_type"


def test_renamed_non_pdf_is_rejected(client: TestClient) -> None:
    response = _upload(client, data=b"\x89PNG\r\n\x1a\n not a pdf")
    assert response.status_code == 415


def test_empty_file_is_rejected(client: TestClient) -> None:
    response = _upload(client, data=b"")
    assert response.status_code in (400, 422)
    assert "error" in response.json()


def test_oversized_upload_is_rejected(client: TestClient) -> None:
    response = _upload(client, data=b"%PDF-1.7\n" + b"0" * (2 * 1024 * 1024))
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "file_too_large"


def test_error_responses_include_cors_headers(client: TestClient) -> None:
    response = _upload(client, data=b"nope", headers=ORIGIN)
    assert response.status_code == 415
    assert response.headers["access-control-allow-origin"] == "http://localhost:4200"


def test_unexpected_errors_are_friendly_and_cors_readable(client: TestClient) -> None:
    response = client.post(CRASH_ENDPOINT, headers=ORIGIN)
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "secret" not in response.text
    assert response.headers["access-control-allow-origin"] == "http://localhost:4200"


def test_disallowed_origin_gets_no_cors_headers(client: TestClient) -> None:
    response = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers


def test_rate_limit() -> None:
    settings = Settings(rate_limit_enabled=True, rate_limit_requests=2, rate_limit_window_seconds=60)
    with TestClient(build_app(settings)) as client:
        statuses = [_upload(client).status_code for _ in range(3)]
        assert statuses == [200, 200, 429]
        assert client.get("/api/health").status_code == 200


@pytest.mark.parametrize("environment", ["development", "production"])
def test_docs_only_exposed_in_development(environment: str) -> None:
    with TestClient(build_app(Settings(environment=environment))) as client:
        expected = 200 if environment == "development" else 404
        assert client.get("/openapi.json").status_code == expected


def test_unknown_route_uses_error_format(client: TestClient) -> None:
    response = client.get("/api/nope")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
