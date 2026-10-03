from fastapi import APIRouter

from app.api.dependencies import AppSettings
from app.models.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(settings: AppSettings) -> HealthResponse:
    return HealthResponse(status="ok", version=settings.app_version)
