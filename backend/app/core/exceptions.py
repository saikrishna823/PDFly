"""Domain exceptions.

Every AppError carries a stable machine-readable ``code`` and a ``message`` that is
safe to show to end users. Internal details belong in logs, never in these messages.
"""

from http import HTTPStatus


class AppError(Exception):
    status_code: int = HTTPStatus.INTERNAL_SERVER_ERROR
    code: str = "internal_error"
    message: str = "Something went wrong on our side. Please try again in a moment."

    def __init__(self, message: str | None = None) -> None:
        if message is not None:
            self.message = message
        super().__init__(self.message)


class InvalidRequestError(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    code = "invalid_request"
    message = "The request is missing required information."


class FileTooLargeError(AppError):
    status_code = HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    code = "file_too_large"
    message = "This file is too large to process."


class UnsupportedFileTypeError(AppError):
    status_code = HTTPStatus.UNSUPPORTED_MEDIA_TYPE
    code = "unsupported_file_type"
    message = "This file type isn't supported by this tool."


class InvalidFileError(AppError):
    status_code = HTTPStatus.UNPROCESSABLE_ENTITY
    code = "invalid_file"
    message = "We couldn't read this file. It may be corrupted or use a format that isn't supported."


class RateLimitedError(AppError):
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    code = "rate_limited"
    message = "You've made a lot of requests in a short time. Please wait a minute and try again."
