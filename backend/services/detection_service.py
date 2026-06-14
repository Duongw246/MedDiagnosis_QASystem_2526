import io

import numpy as np
from PIL import Image
from sqlalchemy.orm import Session

from infrastructures.image_storage_repository import image_to_base64, save_image_to_disk
from infrastructures.object_detection_repository import detect_objects
from repositories.detection_repository import create_detection
from services.image_processing_service import apply_clahe, format_detection_text


def process_image(
    image_bytes: bytes,
    model_name: str,
    conf: float,
    iou: float,
    max_det: int,
    filename: str,
    db: Session,
):
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode != "RGB":
        image = image.convert("RGB")

    img_array = apply_clahe(np.array(image))
    detection_result = detect_objects(
        img_array,
        model_name=model_name,
        conf=conf,
        iou=iou,
        max_det=max_det,
    )
    annotated_img = detection_result["annotated_image"]

    original_path = save_image_to_disk(image, "orig")
    detected_path = save_image_to_disk(annotated_img, "det")

    detections = detection_result["detections"]
    result_text = format_detection_text(detections)

    db_detection = create_detection(
        db,
        filename=filename,
        result=result_text,
        detections=detections,
        original_image_path=original_path,
        detected_image_path=detected_path,
    )

    return {
        "id": db_detection.id,
        "result": result_text,
        "detected_image": image_to_base64(annotated_img),
        "original_image_path": original_path,
        "detected_image_path": detected_path,
        "detections": detections,
        "date": db_detection.upload_date.isoformat(),
    }
