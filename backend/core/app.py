from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import STATIC_DIR
from core.encoding import configure_utf8_stdio
from core.logging import configure_logging_utf8
from db.database import engine
from db.models import Base
from infrastructures.image_storage_repository import ensure_image_storage
from infrastructures.ultralytics_patch import patch_ultralytics_safe_load
from routers import chat, detection, health, history, model, val_dataset


def create_app() -> FastAPI:
    configure_utf8_stdio()
    patch_ultralytics_safe_load()
    Base.metadata.create_all(bind=engine)
    ensure_image_storage()

    app = FastAPI(title="XRAYAPP Backend API")

    app.on_event("startup")(configure_logging_utf8)

    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(history.router)
    app.include_router(model.router)
    app.include_router(detection.router)
    app.include_router(val_dataset.router)
    app.include_router(chat.router)
    return app
