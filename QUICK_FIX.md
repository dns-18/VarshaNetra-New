# VarshaNetra Quick Fix — Demo Prediction Performance

## Problem fixed
`POST /demo/predict` was hanging for minutes because the demo generated a 3x3x30 history and `InferencePipeline.predict(..., with_explanation=True)` ran SHAP `PermutationExplainer` for every row.

## Fix
- `/demo/predict` now runs the full real rainfall/flood/warning pipeline with explanations disabled for the bulk grid inference.
- It computes a single fast local-sensitivity explanation for the center/latest result returned to the dashboard.
- Full SHAP explainability remains available in `pipeline.py` and `explainability/explain.py` for non-demo/offline workflows.
- No ML checkpoints, Thermo-Wind features, warning engine, or API contracts were removed.

## Run
Backend:
```cmd
cd backend
.venv\Scripts\activate.bat
set PYTHONPATH=src
uvicorn varshanetra.inference.api:app --reload --port 8000
```

Frontend (second terminal):
```cmd
cd frontend
npm install
npm run dev
```

`.env.local`:
```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Verify
1. Open `http://127.0.0.1:8000/health` — should report all rainfall/flood models loaded.
2. Open `http://127.0.0.1:8000/demo/regions` — should return the four demo regions.
3. Open `http://localhost:5173/dashboard`.
4. The dashboard should no longer wait for hundreds of SHAP permutation iterations.
