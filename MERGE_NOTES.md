# VarshaNetra merged build

This package combines:

- **Backend:** taken from `VarshaNetra-FINAL-SIH(2).zip` in full, including FastAPI inference API, trained checkpoints, model/training/evaluation code, `_loss` compatibility files, tests, Dockerfile, and Render deployment configuration.
- **Frontend:** based on `VarshaNetra-feature-frontend-dashboard.zip`, retaining its dashboard-oriented layout, authentication page, assets, Tailwind setup, and Leaflet dependencies.
- **Backend-connected frontend pieces:** the final SIH backend integration client (`src/services/varshanetraApi.ts`), reusable Leaflet map component, and API-connected Home, Dashboard, Forecast, Alerts, Reports, and Live Map pages were merged in from the final SIH frontend so the dashboard actually talks to the FastAPI model service.

## Run locally

### Backend

```bash
cd backend
pip install -r requirements.txt
PYTHONPATH=src uvicorn varshanetra.inference.api:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

Set `VITE_API_BASE_URL=http://localhost:8000` in `frontend/.env.local` if needed.

### Docker Compose

```bash
docker compose up --build
```

The frontend uses the FastAPI backend at port 8000 in local Compose and the Render Blueprint wires the deployed URLs automatically.

## Verification

- Backend Python source was syntax-compiled successfully with `python -m compileall`.
- A full frontend build could not be completed in this environment because dependency installation (`npm ci`) exceeded the execution time limit. The ZIP therefore does **not** include `node_modules` or a generated `dist` directory.
