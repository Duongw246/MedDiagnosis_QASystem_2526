from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from db.database import get_db
from repositories import detection_repository


router = APIRouter(prefix="/history", tags=["history"])


@router.get("")
async def get_history(request: Request, db: Session = Depends(get_db)):
    detections = detection_repository.list_detections(db)
    base_url = str(request.base_url).rstrip("/")

    history_list = []
    for detection in detections:
        history_list.append(
            {
                "id": str(detection.id),
                "date": detection.upload_date.strftime("%H:%M %d/%m/%Y"),
                "filename": detection.filename,
                "result": detection.result,
                "detections": detection.detections,
                "original_image": f"{base_url}{detection.original_image_path}",
                "detected_image": f"{base_url}{detection.detected_image_path}",
                "status": detection.status,
            }
        )
    return history_list


@router.put("/{id}/approve")
async def approve_detection(id: int, db: Session = Depends(get_db)):
    detection = detection_repository.approve_detection(db, id)
    if not detection:
        raise HTTPException(status_code=404, detail="Detection not found")
    return {"success": True}


@router.delete("/{id}")
async def delete_detection(id: int, db: Session = Depends(get_db)):
    deleted = detection_repository.delete_detection(db, id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Detection not found")
    return {"success": True}


@router.delete("")
async def delete_all_history(status: str = None, db: Session = Depends(get_db)):
    detection_repository.delete_all_detections(db, status=status)
    return {"success": True}

