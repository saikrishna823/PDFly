from typing import Any

from fastapi.responses import Response

from app.models.errors import ErrorResponse
from app.utils.filenames import content_disposition

ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    status: {"model": ErrorResponse} for status in (400, 413, 415, 422, 429, 500)
}


def file_response(content: bytes, media_type: str, filename: str) -> Response:
    """A downloadable, never-cached binary response."""
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": content_disposition(filename),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
