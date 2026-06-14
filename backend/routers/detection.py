import traceback

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from db.database import get_db
from services.batch_detection_service import analyze_zip
from services.detection_service import process_image


router = APIRouter(tags=["detection"])


@router.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    confidence: float = Form(0.25),
    iou: float = Form(0.45),
    max_det: int = Form(100),
    model: str = Form("best.pt"),
    db: Session = Depends(get_db),
):
    try:
        contents = await file.read()
        result = process_image(contents, model, confidence, iou, max_det, file.filename, db)
        return JSONResponse(content=result)
    except FileNotFoundError as exc:
        traceback.print_exc()
        return JSONResponse(status_code=404, content={"error": str(exc)})
    except Exception as exc:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"Error processing image: {str(exc)}"})


@router.post("/analyze_batch")
async def analyze_batch(
    file: UploadFile = File(...),
    confidence: float = Form(0.25),
    iou: float = Form(0.45),
    max_det: int = Form(100),
    model: str = Form("yolov12s.pt"),
    db: Session = Depends(get_db),
):
    try:
        contents = await file.read()
        status_code, payload = analyze_zip(
            contents,
            model_name=model,
            confidence=confidence,
            iou=iou,
            max_det=max_det,
            db=db,
        )
        return JSONResponse(status_code=status_code, content=payload)
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": f"Error processing ZIP file: {str(exc)}"})

