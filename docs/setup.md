# Setup Guide

## Prerequisites

- Python 3.10+ (3.11 recommended)
- Node.js 18+ and npm
- Git

## 1. Clone

```bash
git clone https://github.com/<your-username>/VarshaNetra.git
cd VarshaNetra
```

## 2. Backend

### Create and activate a virtual environment

**Windows:**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
```

**Linux / macOS:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

`requirements.txt` lists the full dependency set for the complete spec
(including `torch`, `rasterio`, `wradlib`, `shap` for the full deep
architecture and real geospatial data handling). **You do not need all of
these to run the MVP** — the currently-served baseline models and the API
only need:
```bash
pip install numpy pandas scipy scikit-learn pyyaml fastapi uvicorn pydantic
```
Install the rest only if you're training the full deep model
(`training/train.py`) or working with real raster/NetCDF data.

> **Known install friction:** `rasterio`/`wradlib` need system GDAL/GEOS
> libraries. On Ubuntu/Debian: `sudo apt install gdal-bin libgdal-dev`. On
> Windows, prefer `conda install -c conda-forge rasterio wradlib` over pip.
> This only affects the full requirements.txt install, not the minimal one
> above.

### Run the backend API

```bash
PYTHONPATH=src uvicorn varshanetra.inference.api:app --reload --port 8000
```
(Windows PowerShell: `$env:PYTHONPATH="src"; uvicorn varshanetra.inference.api:app --reload --port 8000`)

Verify: `curl http://localhost:8000/health` should return
`{"status": "ok", ...}`.

### Run the full progressive-build pipeline

```bash
python3 run_mvp.py
```
Regenerates synthetic data, runs the Thermo-Wind feature pipeline, the
ablation study, trains all checkpoints, and writes results to `outputs/`.
Takes ~20–30 seconds.

### Run tests

```bash
pip install pytest
PYTHONPATH=src pytest tests/ -v
```
Covers config loading, synthetic data generation, the Thermo-Wind feature
set, leakage-safe splitting, warning-threshold calibration, and — provided
`checkpoints/` has the committed trained models — model loading and a real
demo prediction end to end.

## 3. Frontend

```bash
cd frontend
cp .env.example .env.local      # Windows: copy .env.example .env.local
npm install
npm run dev
```
Open the printed local URL, navigate to `/dashboard`.

### Production build
```bash
npm run build
```
Output in `frontend/dist/`, servable by any static host.

### Environment variables
`frontend/.env.local` (gitignored, copy from `.env.example`):
```env
VITE_API_BASE_URL=http://localhost:8000
```

## 4. Verify the full integration

With the backend running on :8000 and the frontend dev server running:
1. Open the frontend, go to `/dashboard`
2. You should see a green **"Live Model"** badge
3. Switching the region selector (Assam/Meghalaya/Manipur/Mizoram) should
   trigger a new `POST /demo/predict` call and update the metrics
4. Stop the backend and refresh — the badge should switch to red
   **"Backend offline — preview data"**, with a clear message, not a crash
   or a stack trace

If step 3/4 don't behave as described, check:
- `frontend/.env.local`'s `VITE_API_BASE_URL` matches where the backend is
  actually running
- The backend terminal for CORS errors — if the frontend is on a different
  port/host than `localhost:8000`, set `VARSHANETRA_ALLOWED_ORIGINS` (see
  `docs/api.md` "CORS")

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `ModuleNotFoundError: No module named 'varshanetra'` | Forgot `PYTHONPATH=src` before the `uvicorn`/`python` command |
| `/health` shows `"status": "degraded"` | `checkpoints/` is empty or missing — run `python run_mvp.py` to regenerate |
| Frontend shows "Backend offline" even though the backend is running | Check `.env.local`'s URL, and check the browser console for a CORS error |
| `pip install -r requirements.txt` fails on `rasterio`/`wradlib` | See the GDAL note above — install the minimal dependency set instead if you're not touching real raster data |
| `npm install` fails | Confirm Node.js 18+ (`node --version`) |

## What was and wasn't actually tested before this repo was pushed

Everything above **except** `npm install`/`npm run dev`/`npm run build`
themselves, and the deep-model `training/train.py`, was executed and
verified in the environment this repo was assembled in (no internet access
there for `npm install`, no GPU/PyTorch for the deep training loop). See
the root README's "Current Prototype Limitations" for the full, honest
list.
