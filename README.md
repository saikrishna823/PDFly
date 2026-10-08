# PDFly — Private PDF Tools

A privacy-first PDF and document utility. Tools run **in your browser** whenever
that is technically possible; the small FastAPI backend is used only for
operations that genuinely need server-side software, and it never stores files.

| Tool | Where it runs | Status |
|---|---|---|
| Image → PDF | Browser (pdf-lib) | ✅ |
| Images → PDF (reorder, rotate) | Browser (pdf-lib) | ✅ |
| PDF → Image (pick pages, PNG/JPEG, 72–300 DPI, ZIP) | Browser (pdf.js) | ✅ |
| Compress PDF (4 levels; text stays selectable except "Maximum") | Browser (pdf-lib + pdf.js) | ✅ |
| Compress Image (quality or target size, resize, batch ZIP, strips EXIF) | Browser (canvas) | ✅ |
| Word → PDF | Server (LibreOffice) | Phase 3 |
| PDF → Word | Server (permissive engine chosen in Phase 3) | Phase 3 |

Architecture, API contract, security model and roadmap: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Repository layout

```
frontend/   Angular 21 SPA (standalone components, signals) — deployable to GitHub Pages
backend/    FastAPI service — run locally with uvicorn or as a container
docs/       Architecture and delivery plan
.github/    CI: backend tests, frontend build + GitHub Pages deployment
```

## Prerequisites

- **Node.js** 20.19+, 22.12+ or 24+ (npm 11 recommended — see troubleshooting)
- **Python** 3.11+ (tested with 3.13 and 3.14)

## Backend (FastAPI)

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt     # or requirements.txt without test tools
uvicorn app.main:app --reload
```

- API: http://localhost:8000 — interactive docs at http://localhost:8000/docs (development only)
- Tests: `pytest`
- Configuration is via environment variables; copy `.env.example` to `.env` to override.

| Variable | Default | Purpose |
|---|---|---|
| `ENVIRONMENT` | `development` | `production` hides `/docs` and `/openapi.json` |
| `ALLOWED_ORIGINS` | `http://localhost:4200,http://127.0.0.1:4200` | Comma-separated CORS allow-list |
| `MAX_UPLOAD_MB` | `25` | Upload size limit |
| `RATE_LIMIT_ENABLED` / `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` | `true` / `30` / `60` | Per-IP limit on processing endpoints |
| `LOG_LEVEL` | `INFO` | Python log level |

### Docker (optional)

```bash
cd backend
docker build -t pdfly-api .
docker run -p 8000:8000 -e ALLOWED_ORIGINS=https://saikrishna823.github.io pdfly-api
```

The image runs as a non-root user and exposes a health check on `/api/health`.

## Frontend (Angular)

```bash
cd frontend
npm ci            # or: npm install
npx ng serve      # http://localhost:4200
```

- Unit tests: `npx ng test --watch=false`
- Production build: `npx ng build`

### API base URL

The backend URL comes from Angular environment files — never hard-coded:

| File | Used by | Default |
|---|---|---|
| `src/environments/environment.development.ts` | `ng serve` | `http://localhost:8000` |
| `src/environments/environment.ts` | `ng build` (production) | `https://api.example.com` — **change this** to your deployed API |

Keep `maxUploadMb` in sync with the backend's `MAX_UPLOAD_MB`.

## Deployment

**Frontend → GitHub Pages.** `.github/workflows/deploy-frontend.yml` tests, builds
with `--base-href /<repo-name>/`, adds a `404.html` SPA fallback and publishes.
One-time setup: *Settings → Pages → Source: GitHub Actions*. The site will be at
`https://saikrishna823.github.io/<repo-name>/`.

**Backend → any container host** (Render, Fly.io, Railway, Cloud Run, a VM). Set
`ENVIRONMENT=production` and `ALLOWED_ORIGINS=https://saikrishna823.github.io`,
then put the service's HTTPS URL in `frontend/src/environments/environment.ts`.

The browser-based tools keep working even if the backend is not deployed.

## Privacy & security summary

- Browser tools never upload files.
- Server tools: multipart upload over HTTPS, extension + content-signature checks,
  size limits, sanitised filenames, processing in memory (or a per-request temp
  directory that is deleted immediately), `Cache-Control: no-store`, no logging of
  file contents, friendly errors without internal details.

## Licensing

All dependencies are permissively licensed (MIT, BSD, Apache-2.0, Zlib). There are no
GPL/AGPL libraries, so you can host or modify PDFly without having to publish your
source code. The policy and the audited dependency list are in `docs/ARCHITECTURE.md`.

## Troubleshooting

- **`npm install` fails with `Cannot read properties of null (reading 'edgesOut')`** —
  a bug in npm 10.8.x. Use `npm ci` (works from the lockfile) or upgrade npm:
  `npm install -g npm@11`.
- **Angular CLI 22 refuses to run** — Angular 22 needs Node ≥ 22.22.3; this project
  uses Angular 21, which supports older Node 22 releases.
- **"We couldn't reach the PDFly service"** — the backend isn't running, or its URL
  in the environment file is wrong, or your origin is missing from `ALLOWED_ORIGINS`.
