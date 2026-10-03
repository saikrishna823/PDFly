"""Translate exceptions into the API's JSON error format."""

import logging
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import AppError, InvalidRequestError
from app.models.errors import ErrorDetail, ErrorResponse

logger = logging.getLogger(__name__)


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    body = ErrorResponse(error=ErrorDetail(code=code, message=message))
    return JSONResponse(status_code=status_code, content=body.model_dump(), headers={"Cache-Control": "no-store"})


async def _handle_app_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    return error_response(exc.status_code, exc.code, exc.message)


async def _handle_validation_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    # Log field locations only — never submitted values.
    fields = [".".join(str(part) for part in err.get("loc", ())) for err in exc.errors()]
    logger.info("Request validation failed on %s %s: %s", request.method, request.url.path, fields)
    return error_response(InvalidRequestError.status_code, InvalidRequestError.code, InvalidRequestError.message)


async def _handle_http_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    status = HTTPStatus(exc.status_code)
    code = "not_found" if status == HTTPStatus.NOT_FOUND else status.phrase.lower().replace(" ", "_")
    return error_response(exc.status_code, code, status.description or status.phrase)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _handle_app_error)
    app.add_exception_handler(RequestValidationError, _handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, _handle_http_error)
    # Unexpected exceptions are handled by UnhandledErrorMiddleware (see app.api.middleware).
