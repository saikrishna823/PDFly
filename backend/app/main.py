import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import register_exception_handlers
from app.api.middleware import RequestSizeLimitMiddleware, UnhandledErrorMiddleware
from app.api.routes import health
from app.config.settings import Settings, get_settings
from app.core.rate_limit import FixedWindowRateLimiter


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=settings.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        # Interactive docs are handy locally but unnecessary surface area in production.
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )

    app.state.settings = settings
    app.state.rate_limiter = (
        FixedWindowRateLimiter(settings.rate_limit_requests, settings.rate_limit_window_seconds)
        if settings.rate_limit_enabled
        else None
    )

    # add_middleware wraps outward: the last one added runs first. CORS must be outermost so
    # every response, including errors produced by the middleware below it, carries CORS headers.
    app.add_middleware(UnhandledErrorMiddleware)
    app.add_middleware(RequestSizeLimitMiddleware, max_body_bytes=settings.max_upload_bytes)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
        max_age=600,
    )

    register_exception_handlers(app)

    app.include_router(health.router, prefix="/api")
    return app


app = create_app()
