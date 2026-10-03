from collections.abc import Iterator
from typing import Annotated

import pytest
from fastapi import APIRouter, Depends, FastAPI, File, UploadFile
from fastapi.responses import Response
from fastapi.testclient import TestClient

from app.api.dependencies import AppSettings
from app.api.responses import file_response
from app.config.settings import Settings
from app.core.rate_limit import enforce_rate_limit
from app.main import create_app
from app.utils.filenames import output_filename
from app.utils.uploads import PDF, read_validated_upload

UPLOAD_ENDPOINT = "/api/_test/pdf-copy"
CRASH_ENDPOINT = "/api/_test/crash"

# Minimal valid-looking PDF bytes; the upload layer only checks the signature.
SAMPLE_PDF = b"%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n"


def _test_router() -> APIRouter:
    """A stand-in for real tool routes, exercising the shared upload/response/error plumbing."""
    router = APIRouter(dependencies=[Depends(enforce_rate_limit)])

    @router.post(UPLOAD_ENDPOINT)
    async def pdf_copy(file: Annotated[UploadFile, File()], settings: AppSettings) -> Response:
        upload = await read_validated_upload(file, PDF, settings.max_upload_bytes)
        return file_response(upload.data, "application/pdf", output_filename(upload.filename, "-copy", "pdf"))

    @router.post(CRASH_ENDPOINT)
    async def crash() -> Response:
        raise RuntimeError("C:\\secret\\path leaked?")

    return router


def build_app(settings: Settings) -> FastAPI:
    app = create_app(settings)
    app.include_router(_test_router())
    return app


@pytest.fixture
def settings() -> Settings:
    return Settings(max_upload_mb=1, rate_limit_enabled=False, allowed_origins=["http://localhost:4200"])


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(build_app(settings), raise_server_exceptions=False) as test_client:
        yield test_client
