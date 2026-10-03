"""A small in-process, fixed-window rate limiter.

Good enough for a single instance. When running several instances behind a load
balancer, enforce limits at the proxy (nginx, Cloudflare, the hosting platform) instead.
Run uvicorn with ``--proxy-headers`` behind a trusted proxy so ``request.client`` is the
real client address.
"""

import threading
import time
from dataclasses import dataclass

from fastapi import Request

from app.core.exceptions import RateLimitedError


@dataclass
class _Window:
    started_at: float
    count: int


class FixedWindowRateLimiter:
    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._windows: dict[str, _Window] = {}
        self._lock = threading.Lock()

    def allow(self, key: str, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        with self._lock:
            self._evict_expired(now)
            window = self._windows.get(key)
            if window is None:
                self._windows[key] = _Window(started_at=now, count=1)
                return True
            if window.count >= self._max_requests:
                return False
            window.count += 1
            return True

    def _evict_expired(self, now: float) -> None:
        expired = [key for key, w in self._windows.items() if now - w.started_at >= self._window_seconds]
        for key in expired:
            del self._windows[key]


async def enforce_rate_limit(request: Request) -> None:
    """FastAPI dependency for routes that do real processing work.

    The limiter lives on ``app.state`` (set up in ``create_app``); ``None`` disables limiting.
    """
    limiter: FixedWindowRateLimiter | None = request.app.state.rate_limiter
    if limiter is None:
        return
    client = request.client.host if request.client else "unknown"
    if not limiter.allow(client):
        raise RateLimitedError()
