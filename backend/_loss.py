"""Compatibility shim for legacy scikit-learn model checkpoints.

Some bundled pickle files reference the historical top-level ``_loss``
module. Re-export the current scikit-learn loss classes so those
checkpoints can be loaded on modern scikit-learn versions.
"""

try:
    from sklearn._loss._loss import *  # noqa: F401,F403
except ImportError as exc:
    raise ImportError(
        "Unable to load scikit-learn loss compatibility module. "
        "Install the project's requirements.txt with a compatible scikit-learn version."
    ) from exc
