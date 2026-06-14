from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import JSONResponse

from services import val_dataset_service


router = APIRouter(prefix="/val_dataset", tags=["val_dataset"])


@router.get("/images")
async def get_val_dataset_images():
    status_code, payload = val_dataset_service.list_val_images()
    return JSONResponse(status_code=status_code, content=payload)


@router.get("/preview")
async def preview_val_image(image_name: str):
    try:
        return val_dataset_service.preview_val_image(image_name)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi tải preview ảnh val: {str(exc)}")


@router.post("/analyze")
async def analyze_val_image(
    image_name: str = Form(...),
    confidence: float = Form(0.25),
    iou: float = Form(0.45),
    max_det: int = Form(100),
    model: str = Form("best.pt"),
):
    try:
        return val_dataset_service.analyze_val_image(image_name, confidence, iou, max_det, model)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích ảnh val: {str(exc)}")

