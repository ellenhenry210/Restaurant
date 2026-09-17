# SnapOrder

An in-restaurant, table-side ordering system. A QR code tagged to a physical
table lets a guest scan it, view the menu, and place a precise order
directly — not a delivery app, and not just a digital menu. Built to make
ordering faster for both the guest and the waiter.

## Project layout

```
backend/    Express API (Node.js, ESM)
frontend/   React + Vite
```

Design/spec docs live at the repo root: `SNAPORDER_DESIGN_SYSTEM.md`,
`SNAPORDER_DATABASE_SCHEMA.md`, `SNAPORDER_API_CONTRACTS.md`,
`SNAPORDER_AUTHORIZATION.md` (the RBAC/ABAC/IAM/PAM model), and
`SNAPORDER_GITHUB_SETUP.md`.

## Prerequisites

- [Node.js](https://nodejs.org/) v20+ and npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Postgres, Redis, RabbitMQ)

## Quick start

```bash
# 1. Install dependencies for both backend and frontend
npm run setup

# 2. Copy env templates and fill in real values where needed
#    (defaults work as-is for local dev)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start Postgres, Redis, and RabbitMQ
docker-compose up -d

# 4. Apply the database schema (safe to re-run — skips what's already applied)
npm run migrate

# 5. Start the backend and frontend (in separate terminals)
npm run dev:backend    # http://localhost:3000
npm run dev:frontend   # http://localhost:5173
```

RabbitMQ's management UI is at http://localhost:15672 (guest/guest).

### A local-machine quirk worth knowing about

If you already have a native Postgres installation on this machine, it may
already be bound to port 5432 — that's why `docker-compose.yml` maps this
project's Postgres container to host port **5433** instead. `DB_PORT=5433`
in `.env.example` already reflects this; no action needed unless you've
changed the mapping.

## Useful commands

| Command | What it does |
|---|---|
| `npm run setup` | `npm install` in both `backend/` and `frontend/` |
| `npm run migrate` | Applies any new database migrations |
| `npm run dev:backend` | Starts the backend with auto-reload |
| `npm run dev:frontend` | Starts the Vite dev server |
| `docker-compose up -d` | Starts Postgres/Redis/RabbitMQ |
| `docker-compose down` | Stops them (data persists in Docker volumes) |
| `docker-compose logs -f` | Tails logs from all three services |

## Status

Early development. See `SNAPORDER_AUTHORIZATION.md` and the other
`SNAPORDER_*.md` docs at the repo root for the current design specs, and
`SNAPORDER_DATABASE_SCHEMA.md` for what's actually implemented in the
database (`backend/database/migrations/`).
