# Production Deployment Notes

Stat Finder is ready to be deployed as two services plus PostgreSQL:

1. **Web** — the Vite/React build (`Dockerfile.web`)
2. **API** — Express + PostgreSQL (`Dockerfile.api`)
3. **Database** — hosted PostgreSQL containing the ingested NBA tables

## Environment variables

API:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
PORT=8787
ALLOWED_ORIGIN=https://YOUR-WEB-DOMAIN
```

Web build:

```env
VITE_API_BASE_URL=https://YOUR-API-DOMAIN
```

If web and API are served behind the same domain/reverse proxy, `VITE_API_BASE_URL` can remain blank and `/api` can be routed to the API service.

## Health check

Configure the API host to check:

```text
GET /api/health
```

A healthy response confirms both the API process and PostgreSQL connection.

## Build commands without Docker

```bash
npm install
npm run build:all
npm run start:api
```

The static web build is written to `dist/`; the compiled API is written to `dist-server/`.

## Database

Do not run the historical ingestion pipeline inside a request-serving web container. Load or restore PostgreSQL separately, then point `DATABASE_URL` at that hosted database. Before publishing, open **Data QA** in the app and review any integrity flags.
