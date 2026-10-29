# Project Instructions

## Project overview
- SEMF (Smart Energy Monitoring & Forecasting) is a full-stack energy-monitoring app.
- Backend: Python 3.9+, FastAPI, PostgreSQL 17 with TimescaleDB; API source is under `backend/app/`.
- Frontend: React 19, TypeScript, Vite, Tailwind CSS 4; source is under `frontend/src/`.
- User-facing copy is primarily Indonesian. Keep new UI text consistent with that.

## Working conventions
- Preserve the existing separation between FastAPI routes, schemas, security/dependencies, and database access.
- Frontend API calls and shared response types belong in `frontend/src/lib/api.ts`; feature/role permissions are centralized in `frontend/src/lib/features.ts` and route guards in `frontend/src/auth/`.
- Keep authentication token handling consistent with the existing auth provider and API client. Do not bypass role checks for protected features.
- Database changes should be added as ordered SQL migrations under `backend/database/migrations/` (and triggers/views under `backend/database/triggers/` when appropriate). Do not silently rewrite applied migrations.
- Never commit secrets or local `.env` files. Use the existing `.env.example` files as templates.
- Avoid adding dependencies unless existing project utilities cannot reasonably meet the need.

## Validation commands
- Frontend build: from `frontend/`, run `npm run build`.
- Frontend lint: from `frontend/`, run `npm run lint`.
- Backend: from `backend/` with its virtual environment active, run `uvicorn app.main:app --reload`; API health endpoint is `/health`.
- Database-backed backend checks require a configured `.env` and PostgreSQL/TimescaleDB. Do not assume a local database is available.

## Local setup references
- Follow the root `README.md` for database migration order, environment variables, and run instructions.
- The frontend defaults to API URL `http://127.0.0.1:8000`; override it with `VITE_API_URL` when needed.
