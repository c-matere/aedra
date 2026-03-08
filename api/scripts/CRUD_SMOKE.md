# CRUD Smoke Test

Runs a basic create/read/update/delete verification against the API.

## Command

```bash
npm run smoke:crud
```

## Environment

- `AEDRA_API_URL` (optional, default: `http://localhost:3001`)
- `SMOKE_EMAIL` (optional, default: `admin@pwanimanagement.co.ke`)
- `SMOKE_PASSWORD` (optional, default: `Aedra@2026`)

Example:

```bash
AEDRA_API_URL=http://localhost:3001 \
SMOKE_EMAIL=admin@pwanimanagement.co.ke \
SMOKE_PASSWORD='Aedra@2026' \
npm run smoke:crud
```

## What it validates

- Auth login
- Read sanity endpoints (`/me`, `/properties`, `/tenants`, `/landlords`, `/units`, `/expenses`, `/leases`, `/payments`)
- CRUD flows for:
  - properties
  - tenants
  - landlords
  - units
  - expenses
  - payments (if at least one lease exists)
- Cleanup of created smoke records
