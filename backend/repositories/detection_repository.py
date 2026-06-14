from pathlib import Path

from sqlalchemy.orm import Session

from core.config import IMAGES_DIR
from core.encoding import safe_print
from db import models


def create_detection(
    db: Session,
    *,
    filename: str,
    result: str,
    detections: list[dict],
    original_image_path: str,
    detected_image_path: str,
    status: str = "pending",
    commit: bool = True,
):
    detection = models.Detection(
        filename=filename,
        result=result,
        detections=detections,
        original_image_path=original_image_path,
        detected_image_path=detected_image_path,
        status=status,
    )
    db.add(detection)
    if commit:
        db.commit()
        db.refresh(detection)
    else:
        db.flush()
    return detection


def list_detections(db: Session):
    return db.query(models.Detection).order_by(models.Detection.upload_date.desc()).all()


def get_detection(db: Session, detection_id: int):
    return db.query(models.Detection).filter(models.Detection.id == detection_id).first()


def approve_detection(db: Session, detection_id: int):
    detection = get_detection(db, detection_id)
    if detection is None:
        return None
    detection.status = "approved"
    db.commit()
    return detection


def _delete_detection_files(detection):
    try:
        for image_path in (detection.original_image_path, detection.detected_image_path):
            if not image_path:
                continue
            file_path = IMAGES_DIR / Path(image_path).name
            if file_path.exists():
                file_path.unlink()
    except Exception as exc:
        safe_print(f"Error deleting files: {exc}")


def delete_detection(db: Session, detection_id: int):
    detection = get_detection(db, detection_id)
    if detection is None:
        return False
    _delete_detection_files(detection)
    db.delete(detection)
    db.commit()
    return True


def delete_all_detections(db: Session, status: str | None = None):
    query = db.query(models.Detection)
    if status:
        query = query.filter(models.Detection.status == status)

    detections = query.all()
    for detection in detections:
        _delete_detection_files(detection)
        db.delete(detection)

    db.commit()
    return len(detections)

