from typing import Annotated

from fastapi import Depends, Request

from app.config.settings import Settings


def _settings_from_app(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


AppSettings = Annotated[Settings, Depends(_settings_from_app)]
