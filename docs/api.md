# API Reference

Base URL (local dev): `http://localhost:8000`

All endpoints are implemented in `backend/src/varshanetra/inference/api.py`.
This documents the **actual** implemented endpoints — nothing here is
aspirational.

---

## `GET /health`

**Purpose:** Report which lead-time models actually loaded from
`checkpoints/`. `status` is `"degraded"` (not `"ok"`) if either model
family failed to load — e.g. a fresh checkout with an empty
`checkpoints/`.

**Request:** none

**Response:**
```json
{
  "status": "ok",
  "rainfall_models_loaded": [1, 3, 6, 12, 24, 48, 72],
  "flood_models_loaded": [1, 3, 6, 12, 24, 48]
}
```

**Example:**
```bash
curl http://localhost:8000/health
```

---

## `POST /predict/full`

**Purpose:** Full prediction (rainfall + flood + warning + explainability)
from real, already-sourced sensor/satellite/radar/NWP records. This is the
real integration path once you have actual data to send — see
`docs/architecture.md`.

**Request:**
```json
{
  "records": [
    {
      "grid_id": "IND_26.20_92.90",
      "timestamp": "2026-09-04T12:00:00",
      "lat": 26.2,
      "lon": 92.9,
      "features": {
        "ir1_brightness_temp": 245.2,
        "wind_speed_ms": 6.1,
        "gauge_rainfall_mm": 3.4
        /* ...any subset of the fields in docs/model.md; missing fields
           are treated as missing by QualityControl's causal fill */
      }
    }
  ],
  "rainfall_lead_hours": 3,
  "flood_lead_hours": 6,
  "explain": true
}
```

**Response:** `{"predictions": [ ... ]}`, one object per input record,
matching this schema exactly:
```json
{
  "location": "IND_26.20_92.90",
  "forecast_time": "2026-09-04T12:00:00",
  "rainfall_mm": 12.4,
  "rainfall_category": "Moderate",
  "heavy_rain_probability": 0.12,
  "flood_probability": 0.04,
  "inundation_depth_m": 0.0,
  "confidence": 0.81,
  "uncertainty": 0.19,
  "thermo_wind_signal": 0.31,
  "warning_level": "YELLOW",
  "top_contributing_features": [
    "cold_cloud_fraction increased the prediction (contribution=0.42)"
  ]
}
```

**Errors:**
- `400` — `records` is empty
- `503` — no trained model exists for the requested lead-time combination

---

## `POST /predict/rainfall`

**Purpose:** Rainfall-only subset of `/predict/full`'s response (same
request shape, same model call under the hood — this is a convenience
projection, not a separate model path).

**Request:** identical to `/predict/full`

**Response:**
```json
{
  "predictions": [
    {
      "location": "IND_26.20_92.90",
      "forecast_time": "2026-09-04T12:00:00",
      "rainfall_mm": 12.4,
      "rainfall_category": "Moderate",
      "heavy_rain_probability": 0.12,
      "confidence": 0.81,
      "uncertainty": 0.19,
      "warning_level": "YELLOW"
    }
  ]
}
```

---

## `POST /predict/flood`

**Purpose:** Flood-only subset of `/predict/full`'s response.

**Request:** identical to `/predict/full`

**Response:**
```json
{
  "predictions": [
    {
      "location": "IND_26.20_92.90",
      "forecast_time": "2026-09-04T12:00:00",
      "flood_probability": 0.04,
      "inundation_depth_m": 0.0,
      "confidence": 0.81,
      "uncertainty": 0.19,
      "warning_level": "YELLOW"
    }
  ]
}
```

---

## `GET /demo/regions`

**Purpose:** Named regions the demo endpoint recognizes. A frontend region
selector should populate its options from this list rather than
hard-coding region names.

**Request:** none

**Response:**
```json
{
  "regions": [
    {"id": "assam", "label": "Assam", "lat": 26.2, "lon": 92.9, "elevation_m": 45},
    {"id": "meghalaya", "label": "Meghalaya", "lat": 25.5, "lon": 91.4, "elevation_m": 1400},
    {"id": "manipur", "label": "Manipur", "lat": 24.8, "lon": 93.9, "elevation_m": 790},
    {"id": "mizoram", "label": "Mizoram", "lat": 23.7, "lon": 92.7, "elevation_m": 1132}
  ]
}
```

---

## `POST /demo/predict`

**Purpose:** Single-location prediction for UIs without real sensor
ingestion wired up yet. **The model and its prediction are real; the
"current conditions" fed into it are simulated** — see
`backend/src/varshanetra/inference/demo.py`'s docstring. Every response
says so explicitly.

**Request:**
```json
{
  "region": "assam",
  "rainfall_lead_hours": 3,
  "flood_lead_hours": 6
}
```
Alternatively, pass `"lat"` and `"lon"` directly instead of `"region"` for
an arbitrary point.

**Response:** everything `/predict/full` returns for one record, plus:
```json
{
  "...": "... same fields as /predict/full ...",
  "region": "Assam",
  "demo_mode": true,
  "data_source": "synthetic",
  "data_source_notice": "This prediction was produced by the real trained VarshaNetra model, but the 'current conditions' it was given as input are SIMULATED (no live satellite/radar/gauge feed is connected yet) — see inference/demo.py for how to swap in real ingestion.",
  "current_conditions": {
    "rainfall_last_hour_mm": 1.2,
    "wind_speed_ms": 5.8,
    "wind_dir_deg": 214.3,
    "temperature_c": 27.4,
    "relative_humidity_pct": 78.1,
    "soil_moisture_pct": 42.0,
    "river_stage_m": 2.3
  }
}
```

**Errors:**
- `400` — unknown region name, or neither `region` nor `lat`/`lon` provided
- `503` — no trained model exists for the requested lead-time combination

**Example:**
```bash
curl -X POST http://localhost:8000/demo/predict \
  -H "Content-Type: application/json" \
  -d '{"region": "assam", "rainfall_lead_hours": 3, "flood_lead_hours": 6}'
```

---

## `GET /config/thresholds`

**Purpose:** Current warning-level thresholds in use by the running
service.

**Response:**
```json
{"yellow": 0.30, "orange": 0.60, "red": 0.85}
```

---

## `POST /config/calibrate`

**Purpose:** Recalibrate warning-level thresholds from labeled validation
data (precision/recall operating points — see `docs/model.md` "Risk
classification"), and apply them to the running service immediately.

**Request:**
```json
{
  "y_true": [0, 1, 0, 1, 1],
  "y_prob": [0.1, 0.8, 0.3, 0.6, 0.9],
  "target_recalls": {"yellow": 0.85, "orange": 0.70, "red": 0.50}
}
```
`target_recalls` is optional; defaults are documented in
`warning/engine.py::calibrate_thresholds`.

**Response:** same shape as `/config/thresholds`.

---

## CORS

Configurable via the `VARSHANETRA_ALLOWED_ORIGINS` environment variable
(comma-separated origins). Defaults to `*` for local development — set this
explicitly before deploying publicly (see `docs/setup.md`).
