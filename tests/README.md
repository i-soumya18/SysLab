# Tests Layout

This repository keeps test suites inside each app package and exposes them through this top-level `tests/` directory for quick review:

- `tests/frontend` -> `apps/frontend/src/test`
- `tests/backend` -> `apps/backend/src/test`

Run commands from repo root:

```bash
npm run test:frontend
npm run test:backend
```
