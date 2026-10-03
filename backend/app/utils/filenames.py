"""Filename helpers.

User-supplied filenames are only ever used to build the *download* name of a result.
They are never used as filesystem paths.
"""

import re
import unicodedata
from pathlib import PurePosixPath, PureWindowsPath
from urllib.parse import quote

_MAX_STEM_LENGTH = 100
_UNSAFE_CHARS = re.compile(r"[^\w\s.()+-]", flags=re.UNICODE)
_WHITESPACE = re.compile(r"\s+")


def sanitize_filename(name: str | None, fallback: str = "document") -> str:
    """Return a safe display filename: no directories, control or special characters."""
    if not name:
        return fallback
    # Strip any directory part, whichever separator the client used.
    base = PureWindowsPath(PurePosixPath(name).name).name
    base = unicodedata.normalize("NFKC", base)
    base = "".join(ch for ch in base if unicodedata.category(ch)[0] != "C")
    base = _UNSAFE_CHARS.sub("_", base)
    base = _WHITESPACE.sub(" ", base).strip(" .")
    if not base:
        return fallback
    stem, dot, ext = base.rpartition(".")
    if not dot:
        return base[:_MAX_STEM_LENGTH]
    return f"{stem[:_MAX_STEM_LENGTH]}.{ext[:10]}"


def file_stem(name: str | None, fallback: str = "document") -> str:
    safe = sanitize_filename(name, fallback)
    stem = safe.rsplit(".", 1)[0] if "." in safe else safe
    return stem or fallback


def output_filename(original: str | None, suffix: str, extension: str) -> str:
    """Build a result name such as ``report-unlocked.pdf`` from the uploaded name."""
    return f"{file_stem(original)}{suffix}.{extension.lstrip('.')}"


def content_disposition(filename: str) -> str:
    """RFC 6266 attachment header with an ASCII fallback and a UTF-8 ``filename*``."""
    ascii_name = filename.encode("ascii", "ignore").decode().replace('"', "") or "download"
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"
