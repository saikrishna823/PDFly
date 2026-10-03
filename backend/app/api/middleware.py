import logging

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.errors import error_response
from app.core.exceptions import AppError, FileTooLargeError

logger = logging.getLogger(__name__)

# Allowance for multipart boundaries and small form fields on top of the file itself.
_MULTIPART_OVERHEAD_BYTES = 64 * 1024


class RequestSizeLimitMiddleware:
    """Reject requests whose declared body size exceeds the upload limit before reading them.

    A cheap first line of defence; ``read_validated_upload`` still enforces the limit while
    streaming, for clients that omit or misreport ``Content-Length``.
    """

    def __init__(self, app: ASGIApp, max_body_bytes: int) -> None:
        self._app = app
        self._max_body_bytes = max_body_bytes + _MULTIPART_OVERHEAD_BYTES
        self._max_mb = max_body_bytes // (1024 * 1024)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            declared = dict(scope["headers"]).get(b"content-length")
            if declared is not None and declared.isdigit() and int(declared) > self._max_body_bytes:
                response = error_response(
                    FileTooLargeError.status_code,
                    FileTooLargeError.code,
                    f"This file is larger than the {self._max_mb} MB limit.",
                )
                await response(scope, receive, send)
                return
        await self._app(scope, receive, send)


class UnhandledErrorMiddleware:
    """Turn unexpected exceptions into the standard JSON error.

    Starlette handles ``Exception`` outside every user middleware, so those responses would
    miss CORS headers and the browser would report an opaque network failure. Installing this
    inside the CORS middleware keeps 500s readable by the frontend.
    """

    def __init__(self, app: ASGIApp) -> None:
        self._app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        response_started = False

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self._app(scope, receive, tracking_send)
        except Exception:
            logger.exception("Unhandled error on %s %s", scope.get("method"), scope.get("path"))
            if response_started:
                raise
            response = error_response(AppError.status_code, AppError.code, AppError.message)
            await response(scope, receive, send)
