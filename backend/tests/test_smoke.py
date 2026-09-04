"""
Smoke tests — verify the backend actually works end to end with the
dependencies that are guaranteed present (numpy/pandas/scipy/scikit-learn),
not the full torch/fastapi/shap stack. These are the same checks that were
run manually to validate this repository before it was pushed; codifying
them here means `pytest` catches a regression instead of someone finding out
at a hackathon demo.

Run with:
    cd backend && PYTHONPATH=src pytest tests/ -v
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from varshanetra.config import load_config, resolve_path  # noqa: E402
from varshanetra.data.synthetic_data import generate_synthetic_dataset  # noqa: E402
from varshanetra.features.thermo_wind import (  # noqa: E402
    build_thermo_wind_features,
    THERMO_WIND_FEATURE_COLUMNS,
)
from varshanetra.data.dataset import chronological_split  # noqa: E402


@pytest.fixture(scope="module")
def cfg():
    return load_config()


@pytest.fixture(scope="module")
def synthetic_df(cfg):
    return generate_synthetic_dataset(n_lat=4, n_lon=3, n_hours=48, start="2023-06-01", save_path=None)


def test_config_loads(cfg):
    assert "grid" in cfg
    assert "time" in cfg
    assert cfg["time"]["rainfall_lead_hours"] == [1, 3, 6, 12, 24, 48, 72]


def test_repo_relative_paths(cfg):
    """Regression guard for Section 11 of the finalization spec: config
    paths must resolve relative to wherever the repo is actually checked
    out, never to a machine-specific hardcoded path. Verify by confirming
    the resolved checkpoint dir sits under THIS repo's root (derived from
    __file__), and that the config file used to load `cfg` really is the
    one inside this checked-out backend/, not some other machine's copy."""
    from varshanetra.config import REPO_ROOT, DEFAULT_CONFIG_PATH

    assert REPO_ROOT == Path(__file__).resolve().parents[1]
    assert DEFAULT_CONFIG_PATH.exists(), f"config.yaml not found at {DEFAULT_CONFIG_PATH}"
    checkpoint_dir = resolve_path(cfg["paths"]["checkpoint_dir"])
    assert checkpoint_dir == REPO_ROOT / "checkpoints"


def test_synthetic_dataset_shape(synthetic_df):
    assert len(synthetic_df) == 4 * 3 * 48
    assert synthetic_df["grid_id"].nunique() == 12
    # spot-check a few required raw columns exist
    for col in ("ir1_brightness_temp", "wind_speed_ms", "reflectivity_dbz", "cape_j_kg"):
        assert col in synthetic_df.columns


def test_synthetic_rainfall_labels_present(synthetic_df):
    assert "rainfall_mm_t+1h" in synthetic_df.columns
    assert "flood_occurred_t+6h" in synthetic_df.columns
    # rainfall must be non-negative
    assert (synthetic_df["rainfall_mm_t+1h"].dropna() >= 0).all()


def test_thermo_wind_features_compute(synthetic_df, cfg):
    """This is the core innovation (Section 3 of the build spec / Section 3
    of the finalization prompt) — verify every documented Thermo-Wind
    feature actually gets computed, not just a subset."""
    feat_df = build_thermo_wind_features(synthetic_df, cfg)
    missing = [c for c in THERMO_WIND_FEATURE_COLUMNS if c not in feat_df.columns]
    assert not missing, f"Thermo-Wind features missing from output: {missing}"

    # the specific variables the finalization prompt calls out by name
    # must exist under these (or clearly-equivalent) names:
    assert "u_wind" in feat_df.columns
    assert "v_wind" in feat_df.columns
    assert "wind_convergence" in feat_df.columns
    assert "thermal_gradient" in feat_df.columns
    assert "cloud_top_cooling_rate" in feat_df.columns  # "cloud_cooling_rate"
    assert "cold_cloud_fraction" in feat_df.columns


def test_chronological_split_no_leakage(synthetic_df, cfg):
    """Train/val/test must never overlap in time."""
    import copy

    local_cfg = copy.deepcopy(cfg)
    local_cfg["splits"]["train"] = ["2023-06-01", "2023-06-01 23:00"]
    local_cfg["splits"]["validation"] = ["2023-06-02", "2023-06-02 12:00"]
    local_cfg["splits"]["test"] = ["2023-06-02 13:00", "2023-06-03"]
    local_cfg["splits"]["extreme_event_holdout"]["events"] = []

    splits = chronological_split(synthetic_df, local_cfg)
    train_max = pd.to_datetime(splits["train"]["timestamp"]).max()
    val_min = pd.to_datetime(splits["validation"]["timestamp"]).min()
    assert train_max < val_min


def test_warning_engine_thresholds_monotonic():
    from varshanetra.warning.engine import calibrate_thresholds

    rng = np.random.default_rng(0)
    y_true = (rng.random(500) < 0.1).astype(int)
    y_prob = np.clip(y_true * rng.uniform(0.4, 1.0, 500) + (1 - y_true) * rng.uniform(0, 0.5, 500), 0, 1)
    thresholds = calibrate_thresholds(y_true, y_prob)
    assert thresholds.yellow <= thresholds.orange <= thresholds.red


class TestModelLoadingAndInference:
    """These require the trained checkpoints in checkpoints/ to exist — i.e.
    they verify the actual shipped model artifacts, not a freshly-trained
    stand-in."""

    @pytest.fixture(scope="class")
    def pipeline(self, cfg):
        from varshanetra.inference.pipeline import InferencePipeline

        return InferencePipeline(cfg).load_models()

    def test_checkpoints_load(self, pipeline, cfg):
        assert len(pipeline.rainfall_models) > 0, (
            "No rainfall checkpoints loaded — checkpoints/ missing or empty. "
            "Run `python run_mvp.py` to (re)generate them."
        )
        assert len(pipeline.flood_models) > 0, "No flood checkpoints loaded."
        for h in cfg["time"]["rainfall_lead_hours"]:
            assert h in pipeline.rainfall_models, f"Missing rainfall checkpoint for {h}h"

    def test_demo_prediction_matches_output_schema(self, pipeline):
        from varshanetra.inference.demo import predict_for_region

        result = predict_for_region(pipeline, region="assam", rain_lead_hours=3, flood_lead_hours=6)
        required_keys = {
            "location", "forecast_time", "rainfall_mm", "rainfall_category",
            "heavy_rain_probability", "flood_probability", "inundation_depth_m",
            "confidence", "uncertainty", "warning_level", "top_contributing_features",
        }
        assert required_keys.issubset(result.keys())
        assert result["warning_level"] in ("GREEN", "YELLOW", "ORANGE", "RED")
        assert result["demo_mode"] is True
        assert 0.0 <= result["confidence"] <= 1.0

    def test_unknown_region_raises(self, pipeline):
        from varshanetra.inference.demo import predict_for_region

        with pytest.raises(ValueError):
            predict_for_region(pipeline, region="not-a-real-region")
