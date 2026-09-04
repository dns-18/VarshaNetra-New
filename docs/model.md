# Model

## Input features

All field names below are the exact column names in
`backend/src/varshanetra/data/schema.py` — this is the single source of
truth the rest of the codebase reads from.

### Satellite-derived
```
ir1_brightness_temp, ir2_brightness_temp, wv_brightness_temp,
cloud_top_temp, cloud_top_height_km, olr, cmv_u, cmv_v,
insat_qpe_mm, imerg_precip_mm
```

### Radar-derived
```
reflectivity_dbz, radial_velocity_ms, spectral_width,
echo_top_height_km, vil_kg_m2, radar_rainfall_rate_mmhr
```

### Ground observations
```
gauge_rainfall_mm, temperature_c, relative_humidity_pct,
wind_speed_ms, wind_dir_deg, pressure_hpa, soil_moisture_pct,
river_stage_m
```

### NWP-derived
```
precip_forecast_mm, temperature_c_nwp, rh_pct_nwp,
u_wind_925hpa, v_wind_925hpa, cape_j_kg, cin_j_kg,
vertical_velocity, geopotential_500hpa
```

### Static / terrain (not per-timestep)
```
elevation_m, slope_deg, lulc_class, soil_type,
distance_to_river_m, drainage_density, historical_flood_freq
```

**Honesty note:** in this repository, every one of the above is currently
populated by a synthetic data generator
(`backend/src/varshanetra/data/synthetic_data.py`), not a live feed — see
the root README's "Current Prototype Limitations". The column *names* and
*semantics* match what a real INSAT/radar/gauge/NWP ingestion pipeline would
populate; only the current *values* are simulated.

## Engineered features — the Thermo-Wind module

This is the project's core innovation
(`backend/src/varshanetra/features/thermo_wind.py`). It is explicitly
**engineered**, not raw-sourced: every feature below is computed from the
raw inputs above, never asserted as directly observed.

### Thermal (temporal, per grid cell)
| Feature | Computed as |
|---|---|
| `ir1_bt_mean_3h`, `ir1_bt_std_3h`, `ir1_bt_min_6h` | Rolling statistics of `ir1_brightness_temp`, past-only |
| `thermal_gradient` | Timestep-to-timestep change in `ir1_brightness_temp` |
| `cloud_top_cooling_rate` | `max(-thermal_gradient, 0)` |
| `cloud_top_warming_rate` | `max(thermal_gradient, 0)` |
| `thermal_anomaly` | `ir1_brightness_temp` minus a per-cell, per-hour-of-day historical baseline |

### Thermal (spatial, per timestamp)
| Feature | Computed as |
|---|---|
| `spatial_thermal_variance` | Variance of `ir1_brightness_temp` across a cell's nearest neighbors |
| `cold_cloud_fraction` | 1 if a cell's brightness temp is below the cold-cloud threshold (235K, configurable) |
| `connected_cold_cloud_fraction` | Fraction of a cell's neighbors also below threshold — a lightweight proxy for connected cold-cloud region size |
| `cmv_speed`, `cmv_direction_deg` | Derived from the satellite cloud motion vectors `cmv_u`/`cmv_v` |

### Wind
| Feature | Computed as |
|---|---|
| `u_wind`, `v_wind` | Decomposed from `wind_speed_ms` + `wind_dir_deg` |
| `wind_speed_gradient` | Neighbor-mean minus center-cell wind speed |
| `wind_convergence` | Sign-flipped local wind-divergence proxy (finite-difference over the neighbor stencil) — higher means more moisture inflow |
| `wind_dir_change`, `wind_speed_change` | Timestep-to-timestep change (wind direction change is angle-wrapped) |
| `moisture_transport_proxy` | `wind_speed_ms × relative_humidity_pct / 100` |
| `wind_shear_surface_925` | Vector difference between surface wind and NWP 925hPa wind |

### Explicit thermal × wind interaction terms
```
cooling_rate_x_wind_speed, cooling_rate_x_convergence,
cold_cloud_fraction_x_convergence, cloud_top_temp_x_wind_speed,
thermal_gradient_x_wind_dir, thermal_anomaly_x_convergence,
cloud_motion_dir_x_wind_dir
```
These are **candidate predictors**, not asserted causal mechanisms — their
value is established by the ablation study below, not claimed up front.

## Ablation study — does Thermo-Wind actually help?

`backend/src/varshanetra/training/ablation.py` trains four progressively
richer baselines (NWP+weather only → +satellite → +radar → full
Thermo-Wind) and compares rainfall-prediction accuracy. Real results from an
actual run are in `backend/outputs/ablation_thermo_wind_effect.csv` and
`ablation_rainfall_results.csv` — reproduce with `python run_mvp.py`.

Measured on the synthetic dataset (see limitations above — this validates
that the *measurement pipeline* works correctly, not real-world skill):
Thermo-Wind features reduced 1-hour rainfall MAE by ~19.5% over the
radar+satellite+NWP baseline without them.

## Prediction pipeline

1. **Preprocessing** (`inference/pipeline.py::QualityControl`) — range-checks
   each raw field, flags/nulls out-of-range values, causally forward-fills
   gaps per grid cell.
2. **Feature engineering** — the Thermo-Wind pipeline above runs on the
   QC'd data.
3. **Model inference** — one gradient-boosted regressor + one classifier per
   (task, lead-time) combination (`training/baseline.py`). Feature ordering
   is fixed per model at training time (`model.feature_cols`) and reused
   identically at inference — this is what prevents a silent
   feature-order mismatch between training and serving.
4. **Risk classification** (`warning/engine.py`) — `max(heavy_rain_probability,
   flood_probability)` is compared against calibrated thresholds
   (`calibrate_thresholds`, fit from validation-set precision/recall
   operating points — not hardcoded) to produce GREEN/YELLOW/ORANGE/RED.
5. **Explainability** (`explainability/explain.py`) — SHAP (or, if the
   `shap` package isn't installed, a documented local-sensitivity fallback)
   attributes the prediction to its top contributing input features.

## Full deep architecture (implemented, not yet trained)

`backend/src/varshanetra/models/` implements the complete multimodal
architecture the project is designed around:

- **5 branch encoders**: ConvLSTM (satellite, radar), Transformer
  (meteorology, NWP), MLP (static terrain) — `models/encoders.py`
- **Cross-attention + gating fusion** — `models/fusion.py`
- **Multi-task heads** (rainfall regression/classification, flood
  classification/depth/segmentation) with a weighted multi-task loss
  including focal loss for class imbalance — `models/losses.py`,
  `models/varshanetra_model.py`
- **MC-dropout uncertainty estimation** —
  `models/varshanetra_model.py::predict_with_uncertainty`
- **Optional river/drainage GNN branch** — `models/gnn.py`, currently using
  a k-nearest-neighbor proxy graph rather than real hydrological network
  topology (documented swap-in point in that file)
- **Training loop** — `training/train.py`

This has been syntax-verified and shape-checked against real (synthetic)
data — every branch's windowed tensor shape was confirmed to match its
encoder's declared input size — but **has never actually executed a
training step**, since the development environment had no GPU/PyTorch/
internet access. See `docs/setup.md` for what you'd need to actually train
it.
