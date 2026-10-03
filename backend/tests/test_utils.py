import pytest

from app.config.settings import Settings
from app.core.rate_limit import FixedWindowRateLimiter
from app.utils.filenames import content_disposition, output_filename, sanitize_filename


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("report.pdf", "report.pdf"),
        ("../../etc/passwd", "passwd"),
        ("C:\\Users\\me\\My File.pdf", "My File.pdf"),
        ("bad<>:\"|?*name.pdf", "bad_______name.pdf"),
        ("..", "document"),
        ("", "document"),
        (None, "document"),
        ("résumé.pdf", "résumé.pdf"),
        ("a\x00b\x1f.pdf", "ab.pdf"),
    ],
)
def test_sanitize_filename(raw: str | None, expected: str) -> None:
    assert sanitize_filename(raw) == expected


def test_sanitize_filename_caps_length() -> None:
    assert len(sanitize_filename("x" * 500 + ".pdf")) <= 105


def test_output_filename() -> None:
    assert output_filename("Annual report.pdf", "-unlocked", "pdf") == "Annual report-unlocked.pdf"
    assert output_filename(None, "-unlocked", ".pdf") == "document-unlocked.pdf"


def test_content_disposition_has_ascii_fallback_and_utf8() -> None:
    header = content_disposition("résumé.pdf")
    assert 'filename="rsum.pdf"' in header
    assert "filename*=UTF-8''r%C3%A9sum%C3%A9.pdf" in header


def test_rate_limiter_window() -> None:
    limiter = FixedWindowRateLimiter(max_requests=2, window_seconds=10)
    assert limiter.allow("a", now=0) and limiter.allow("a", now=1)
    assert not limiter.allow("a", now=2)
    assert limiter.allow("b", now=2)
    assert limiter.allow("a", now=10)


def test_allowed_origins_parsed_from_comma_separated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://a.example/, https://b.example")
    assert Settings().allowed_origins == ["https://a.example", "https://b.example"]
