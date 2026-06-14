from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BASE_DIR.parent

STATIC_DIR = BASE_DIR / "static"
IMAGES_DIR = STATIC_DIR / "images"
WEIGHTS_DIR = PROJECT_DIR / "frontend" / "weights"

VAL_DATA_DIR = PROJECT_DIR / "Val data"
VAL_IMAGES_DIR = VAL_DATA_DIR / "images"
VAL_LABELS_DIR = VAL_DATA_DIR / "labels"

MAX_ZIP_SIZE_MB = 100
MAX_ZIP_SIZE_BYTES = MAX_ZIP_SIZE_MB * 1024 * 1024
ALLOWED_BATCH_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg")
VAL_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg")

