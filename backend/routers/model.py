import traceback

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from core.encoding import safe_print
from infrastructures.yolo_model_repository import get_available_weight_names, load_model


router = APIRouter(tags=["models"])


@router.get("/load_model")
async def load_model_endpoint(model: str = "yolo12s.pt"):
    try:
        load_model(model)
        return JSONResponse(
            content={
                "success": True,
                "message": "Model YOLO12s loaded successfully",
                "model": "yolo12s.pt",
            }
        )
    except Exception as exc:
        safe_print(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Error loading model: {str(exc)}"},
        )


@router.get("/models/weights")
async def get_available_weights():
    weights = get_available_weight_names()
    return {"weights": weights, "total": len(weights)}
