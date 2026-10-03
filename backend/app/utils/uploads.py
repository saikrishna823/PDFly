"""Reading and validating uploaded files.

Uploads are untrusted: we check the extension *and* the file's leading bytes, and we
enforce the size limit while reading so an oversized body never sits fully in memory.
"""

from collections.abc import Callable
from dataclasses import dataclass

from fastapi import UploadFile

from app.core.exceptions import FileTooLargeError, InvalidFileError, UnsupportedFileTypeError
from app.utils.filenames import sanitize_filename

_CHUNK_SIZE = 1024 * 1024


@dataclass(frozen=True)
class FileKind:
    label: str
    extensions: frozenset[str]
    matches_signature: Callable[[bytes], bool]


def _looks_like_pdf(data: bytes) -> bool:
    # The PDF spec allows the header anywhere in the first 1024 bytes.
    return b"%PDF-" in data[:1024]


def _looks_like_zip(data: bytes) -> bool:
    return data.startswith(b"PK\x03\x04")


PDF = FileKind("PDF", frozenset({".pdf"}), _looks_like_pdf)
DOCX = FileKind("Word (.docx)", frozenset({".docx"}), _looks_like_zip)


@dataclass(frozen=True)
class ValidatedUpload:
    filename: str
    data: bytes


async def read_validated_upload(upload: UploadFile, kind: FileKind, max_bytes: int) -> ValidatedUpload:
    filename = sanitize_filename(upload.filename)
    extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in kind.extensions:
        raise UnsupportedFileTypeError(f"Please choose a {kind.label} file.")

    chunks: list[bytes] = []
    total = 0
    while chunk := await upload.read(_CHUNK_SIZE):
        total += len(chunk)
        if total > max_bytes:
            raise FileTooLargeError(f"This file is larger than the {max_bytes // (1024 * 1024)} MB limit.")
        chunks.append(chunk)

    data = b"".join(chunks)
    if not data:
        raise InvalidFileError("This file is empty.")
    if not kind.matches_signature(data):
        raise UnsupportedFileTypeError(
            f"This doesn't look like a valid {kind.label} file. It may be corrupted or renamed."
        )
    return ValidatedUpload(filename=filename, data=data)
