from pathlib import Path

from ultralytics import YOLO

from core.config import BASE_DIR, PROJECT_DIR, WEIGHTS_DIR
from core.encoding import safe_print


models_cache = {}


def get_available_weight_names():
    candidate_dirs = [
        WEIGHTS_DIR,
        PROJECT_DIR / "weights",
        BASE_DIR / "weights",
        BASE_DIR,
        Path("weights"),
        Path("..").resolve() / "weights",
        Path("..").resolve() / "frontend" / "weights",
    ]

    weight_names = set()
    for directory in candidate_dirs:
        try:
            dir_path = directory.resolve() if not directory.is_absolute() else directory
            if not dir_path.exists() or not dir_path.is_dir():
                continue
            for weight_file in dir_path.glob("*.pt"):
                if weight_file.is_file():
                    weight_names.add(weight_file.name)
        except Exception:
            continue

    return sorted(weight_names)


def load_model(model_name: str = "best.pt"):
    if model_name and "." not in model_name:
        model_name = f"{model_name}.pt"
    if model_name in models_cache:
        return models_cache[model_name]

    potential_paths = [
        WEIGHTS_DIR / model_name,
        Path("weights") / model_name,
        BASE_DIR / "weights" / model_name,
        BASE_DIR / model_name,
        Path("..") / "weights" / model_name,
        Path("..") / "frontend" / "weights" / model_name,
        WEIGHTS_DIR / "best.pt",
        Path("weights") / "best.pt",
    ]

    model_path = None
    for path in potential_paths:
        if path.exists():
            model_path = path
            break

    if model_path:
        safe_print(f"Loading custom trained model from: {model_path}")
        try:
            models_cache[model_name] = YOLO(str(model_path))
            safe_print(f"✓ Custom model {model_name} loaded successfully")
            return models_cache[model_name]
        except Exception as exc:
            safe_print(f"Warning: Failed to load custom model from {model_path}: {str(exc)}.")

    safe_print(
        f"Warning: Model file for '{model_name}' not found locally in expected paths. "
        "Attempting to load as standard model..."
    )
    try:
        models_cache[model_name] = YOLO(model_name)
        safe_print(f"✓ Standard model {model_name} loaded successfully")
        return models_cache[model_name]
    except Exception as exc:
        raise Exception(
            f"Failed to load model '{model_name}'. Ensure the .pt file exists in 'weights/' "
            f"folder or is a valid YOLO model name. Error: {str(exc)}"
        )

