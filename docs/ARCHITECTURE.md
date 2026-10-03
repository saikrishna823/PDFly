# PDFly — Architecture & Delivery Plan

PDFly is a privacy-first PDF and document utility. Every tool runs in the
browser when that is technically sound; the Python backend is only used for
operations that genuinely need it, and it never stores files.

---

## 1. High-level architecture

```
┌──────────────────────────── User's device ────────────────────────────┐
│                                                                        │
│   Angular SPA (GitHub Pages, static)                                   │
│   ┌──────────────┐   ┌────────────────────────┐                       │
│   │ Tool pages   │──▶│ Local processors        │──▶ Blob ─▶ Download   │
│   │ (features/*) │   │ pdf-lib, pdf.js, canvas │   (file never leaves) │
│   │              │   └────────────────────────┘                       │
│   │              │   ┌────────────────────────┐                       │
│   │              │──▶│ ApiService (HttpClient) │──┐                    │
│   └──────────────┘   └────────────────────────┘  │ multipart/form-data │
└──────────────────────────────────────────────────┼────────────────────┘
                                                   │ HTTPS
┌──────────────────────── FastAPI service ─────────▼────────────────────┐
│  Middleware: CORS · request-size guard · rate limit                    │
│  api/routes/*      thin: parse form → validate → call service          │
│  services/*        business logic (LibreOffice, ... — Phase 3)         │
│  utils/*           upload validation, filenames, temp workspaces       │
│                                                                        │
│  Bytes in memory where possible; otherwise a private temp directory    │
│  that is deleted in a `finally` block as soon as the response is built │
└────────────────────────────────────────────────────────────────────────┘
```

Key principles

- **Tool registry** — one typed list (`frontend/src/app/models/tool.ts`) describes
  every tool: route, title, icon, *where it runs* (`local` | `server`) and status.
  The home page, header and privacy notices all read from it, so the privacy
  message cannot drift from reality, and adding a tool is one entry + one feature
  folder.
- **Same UX skeleton for every tool** — Upload → Configure → Preview → Process →
  Download, built from shared components (drop zone, file list, privacy notice,
  progress, result panel).
- **Stateless backend** — no database, no auth, no queues, no persistent storage.
  Horizontal scaling is "run another container".

## 2. Folder structure

```
PDFly/
├── docs/ARCHITECTURE.md
├── README.md
├── .github/workflows/
│   ├── deploy-frontend.yml          # test + build + publish to GitHub Pages
│   └── backend-tests.yml            # pytest on backend changes
├── frontend/
│   ├── angular.json, package.json, tsconfig*.json
│   ├── public/favicon.svg
│   └── src/
│       ├── environments/            # environment.ts (prod) / environment.development.ts
│       ├── styles.css               # design tokens (light + dark), buttons, forms
│       └── app/
│           ├── app.ts / app.routes.ts / app.config.ts
│           ├── core/
│           │   ├── config/          # APP_CONFIG injection token (wraps environment)
│           │   └── layout/          # site-header, site-footer
│           ├── shared/
│           │   ├── components/      # icon, file-dropzone, privacy-notice, tool-header,
│           │   │                    # progress-indicator, result-panel, error-alert
│           │   ├── pipes/           # file-size
│           │   └── utils/           # download, file-accept, file-names, page-ranges
│           ├── features/            # one folder per page (lazy-loaded)
│           │   ├── home/
│           │   ├── image-pdf/       # shared workspace for both image tools:
│           │   │                    # image-pdf-tool, image-page-list, page-preview, image-pdf-settings
│           │   ├── image-to-pdf/    # thin page → image-pdf-tool (single)
│           │   ├── images-to-pdf/   # thin page → image-pdf-tool (multiple)
│           │   ├── pdf-to-image/    # pdf-to-image page + page-picker
│           │   └── word-to-pdf/, pdf-to-word/   (Phase 3)
│           ├── services/            # image-pdf-converter, image-loader, image-inspection,
│           │                        # page-layout, pdf-renderer (pdf.js), zip-builder (fflate),
│           │                        # api-client (ready for server tools)
│           └── models/              # tool registry, image-pdf & pdf-image options, api-error, app-config
└── backend/
    ├── requirements.txt / requirements-dev.txt / pyproject.toml (pytest config)
    ├── Dockerfile / .dockerignore / .env.example
    ├── app/
    │   ├── main.py                  # create_app(): middleware, routers, handlers
    │   ├── config/settings.py       # pydantic-settings, env-driven
    │   ├── api/
    │   │   ├── routes/              # health.py (+ tool routes from Phase 3)
    │   │   ├── dependencies.py      # AppSettings dependency (settings from app.state)
    │   │   ├── errors.py            # exception → JSON error mapping
    │   │   ├── middleware.py        # request-size guard, CORS-safe 500 handler
    │   │   └── responses.py         # file_response(), OpenAPI error docs
    │   ├── core/
    │   │   ├── exceptions.py        # AppError hierarchy (user-safe messages)
    │   │   └── rate_limit.py        # fixed-window limiter + dependency
    │   ├── services/
    │   │   ├── pdf_image_service.py     (only if a server fallback is ever needed)
    │   │   ├── word_pdf_service.py      (Phase 3)
    │   │   └── pdf_word_service.py      (Phase 3)
    │   ├── models/                  # Pydantic response/error schemas
    │   └── utils/                   # uploads.py (validation), filenames.py; temp.py in Phase 3
    └── tests/
```

`image_pdf_service.py` from the original outline is intentionally absent: image → PDF
runs in the browser, so there is no server code path to maintain.

## 3. Technology & library choices

| Concern | Choice | Why |
|---|---|---|
| Frontend framework | Angular 21, standalone components, signals, zoneless | Requested; signals keep tool state simple without a store library. (Angular 22 needs Node ≥ 22.22.3; 21 runs on the current dev machine and is still supported — upgrade later with `ng update`) |
| Styling | Hand-written CSS with custom-property design tokens | No UI library needed for this surface; full control over a11y and look |
| Image → PDF (browser) | **pdf-lib** | Embeds JPEG/PNG *without re-encoding*, precise page geometry, MIT. Low release cadence, but the API is stable and the image path is mature |
| PDF rendering (browser) | **pdfjs-dist** 6 (Mozilla) | Firefox's own renderer, actively maintained; parsing runs in a Web Worker. The worker, CMaps, standard fonts, ICC profile and image decoders (JPEG 2000, JBIG2) are copied into the build under `/pdfjs/` by `angular.json`, so nothing is fetched from a CDN. The JavaScript engine for PDF form scripts (`quickjs`) is deliberately not shipped |
| ZIP (browser) | **fflate** | Small, fast, maintained. Entries are stored uncompressed: PNG/JPEG data is already compressed |
| WebP / EXIF handling | Native `createImageBitmap` + `<canvas>` | Built into browsers, no dependency |
| API | **FastAPI + Pydantic v2 + Uvicorn** | Requested; typed, async, automatic OpenAPI docs |
| Config | **pydantic-settings** | Env-driven settings validated at startup |
| Multipart | **python-multipart** | Required by FastAPI for `UploadFile` |
| DOCX → PDF (Phase 3) | **LibreOffice headless** (`soffice --convert-to pdf`) | The only free engine with real Word layout fidelity. Run as a separate program, so its MPL-2.0 licence places no obligations on PDFly's code |
| PDF → DOCX (Phase 3) | To be chosen in Phase 3 from permissive options: LibreOffice's PDF import (`--infilter=writer_pdf_import`), or pdfplumber (MIT) + python-docx (MIT) | `pdf2docx` was ruled out because it depends on PyMuPDF (AGPL). Both candidates will be compared on sample documents |
| Tests | pytest + httpx2 (FastAPI `TestClient`); Vitest via the Angular CLI | Standard, no extra infra |

**Licensing policy.** Every dependency must be permissively licensed (MIT, BSD,
Apache-2.0, ISC, Zlib or similar), so PDFly can be used, modified and hosted without
having to publish source code. AGPL/GPL libraries are excluded; notably **PyMuPDF**
and **pdf2docx** (AGPL). External programs called as separate processes (LibreOffice)
are fine. Current runtime dependencies, as audited:

- Backend: FastAPI, Starlette, Pydantic, pydantic-settings, Uvicorn (MIT/BSD);
  python-multipart (Apache-2.0)
- Frontend (shipped to browsers): Angular (MIT), RxJS (Apache-2.0), pdf-lib (MIT),
  pako (MIT / Zlib), tslib (0BSD), pdfjs-dist (Apache-2.0) with its decoders — PDFium
  JBIG2 (BSD-3), OpenJPEG (BSD-2), qcms (MIT) — and ICC profile (CC0), fflate (MIT)
- Possible later: pypdfium2 (Apache-2.0 / BSD-3) if a server-side PDF → image fallback
  is ever needed

Deliberately **not** used: Angular Material, NgRx, Redis, a database, Celery,
cloud storage, auth.

## 4. Browser vs backend — per tool

| Tool | Runs | Engine | Reasoning |
|---|---|---|---|
| Image → PDF | **Browser** | pdf-lib | Images embed directly into PDF pages; nothing needs a server |
| Images → PDF | **Browser** | pdf-lib | Same engine, multi-page; reorder/rotate are just page parameters |
| PDF → Image | **Browser** | pdf.js + canvas + fflate | pdf.js renders at print quality locally. An optional server fallback (pypdfium2) may be added for PDFs pdf.js cannot open, but is *opt-in and clearly labelled* |
| Word → PDF | **Server** | LibreOffice | No browser engine reproduces Word layout reliably |
| PDF → Word | **Server** | LibreOffice or pdfplumber + python-docx (Phase 3) | Requires layout analysis that only exists in Python/native code |

The UI shows **"Processed locally — your file does not leave your device"** for
browser tools and **"Temporary server processing — your file is processed
temporarily and is not permanently stored"** for server tools. Both strings are
driven by the tool registry.

## 5. API contract

Base URL: `environment.apiBaseUrl` (e.g. `http://localhost:8000` in dev).
All uploads are `multipart/form-data`. All successful conversions return the
binary file with `Content-Disposition: attachment` and `Cache-Control: no-store`.

### Errors (every endpoint)

```json
{ "error": { "code": "invalid_file", "message": "We couldn't read this file. It may be corrupted or use a format that isn't supported." } }
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `invalid_request` | Missing/empty fields |
| 413 | `file_too_large` | Over `MAX_UPLOAD_MB` (default 25) |
| 415 | `unsupported_file_type` | Extension or magic bytes don't match |
| 422 | `invalid_file` | Corrupt / unreadable document |
| 429 | `rate_limited` | Too many requests from one client |
| 500 | `internal_error` | Unexpected failure (details only in server logs) |
| 503 | `converter_unavailable` | LibreOffice missing / timed out (Phase 3) |

### Endpoints

| Method & path | Form fields | Success response | Phase |
|---|---|---|---|
| `GET /api/health` | — | `200 {"status":"ok","version":"x.y.z"}` | 1 |
| `POST /api/word-to-pdf` | `file` (DOCX) | `200 application/pdf` | 3 |
| `POST /api/pdf-to-word` | `file` (PDF), `pages` (optional, e.g. `1-3,5`) | `200 application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 3 |
| `POST /api/pdf-to-image` *(optional fallback, pypdfium2)* | `file`, `format` (`png`/`jpeg`), `dpi` (72–300), `pages` | `200 application/zip` | 2+ |

In Phase 1 the backend serves only `/api/health`; the shared upload validation,
error format, size guard and rate limiter are in place and covered by tests, ready
for the Phase 3 conversion routes.

## 6. Deployment architecture

```
 GitHub repo (saikrishna823/PDFly)
   │ push to main (frontend/**)
   ▼
 GitHub Actions ── ng build --configuration production --base-href /PDFly/
   │                copy index.html → 404.html (SPA deep links)
   ▼
 GitHub Pages  https://saikrishna823.github.io/PDFly/      (static, no server)
   │  HTTPS + CORS
   ▼
 FastAPI container (any container host: Render, Fly.io, Railway, Cloud Run, a VM)
   https://api.<your-domain>   ← environment.prod.ts apiBaseUrl
   ALLOWED_ORIGINS=https://saikrishna823.github.io
```

- The frontend is fully static; local tools keep working even if the API is down.
- API base URL is set per build in `src/environments/environment*.ts`; no URL
  is hard-coded in components or services.
- Backend config is 100% environment variables (`.env.example` documents them).
- Docker is optional: `uvicorn app.main:app --reload` is the dev path.

## 7. Security considerations

| Threat / requirement | Mitigation |
|---|---|
| Untrusted uploads | Extension allow-list **and** magic-byte check per tool; never trust `Content-Type` alone |
| Oversized uploads / memory exhaustion | `Content-Length` guard middleware rejects early with 413; streaming read enforces the same cap when the header lies or is absent |
| Path traversal / header injection via filenames | Filenames are sanitised (basename only, safe charset, length cap) and only used for the *download* name; storage paths are random |
| Persistent storage | None. Phase 3 uses `tempfile.TemporaryDirectory` per request, removed in `finally` |
| Executing uploaded content | Never executed. LibreOffice runs via `subprocess.run([...], shell=False)` with a fixed argv, timeout, isolated per-request profile dir, and no macros |
| Leaking server details | Generic handler returns friendly messages; stack traces and paths only go to logs |
| Cross-origin abuse | CORS allow-list from `ALLOWED_ORIGINS`; no cookies/credentials |
| Abuse / DoS | Per-IP fixed-window rate limiter on processing routes (in-process; use the reverse proxy's limiter in multi-instance deployments); conversion concurrency cap (Phase 3) |
| Response caching | `Cache-Control: no-store` on every processed file |
| Container | Slim base image, non-root user, no build tools at runtime |

## 8. Development phases

| Phase | Scope | Status |
|---|---|---|
| **1 — Foundation** | Angular shell, design system, tool registry, home page; shared drop zone / file list / privacy notice / progress / result panel; env-based API config. **Image → PDF** and **Images → PDF** (browser). FastAPI foundation: settings, CORS, error model, upload validation, size guard, rate limit, health. Backend tests, Dockerfile, README, GitHub Pages workflow | ✅ Done |
| 2 — PDF → Image | pdf.js in a worker, page thumbnails with select-all/none and page ranges, PNG/JPEG, JPEG quality, 72/150/300 DPI, single download or ZIP plus per-page downloads, cancel. Password-protected PDFs are reported, not opened | ✅ Done |
| 3 — Office conversions (next) | Word → PDF via LibreOffice (timeouts, concurrency semaphore, per-request profile), PDF → Word via the better of LibreOffice import or pdfplumber + python-docx, with clear quality caveats; Docker image with LibreOffice + fonts | |
| 4 — Hardening & polish | E2E tests, accessibility audit (axe), backend CI, CSP/security headers, backend deployment guide, optional PWA/offline for local tools | |
