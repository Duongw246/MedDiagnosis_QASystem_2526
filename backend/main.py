import uvicorn

from core.app import create_app
from core.config import WEIGHTS_DIR
from core.encoding import safe_print


app = create_app()


if __name__ == "__main__":
    safe_print("--- Restarting Backend ---")
    safe_print(f"Weights directory: {WEIGHTS_DIR}")
    safe_print(f"Available models: {list(WEIGHTS_DIR.glob('*.pt')) if WEIGHTS_DIR.exists() else []}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
