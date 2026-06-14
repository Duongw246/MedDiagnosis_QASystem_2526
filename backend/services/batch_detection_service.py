import base64
import io
import zipfile

import numpy as np
from PIL import Image
from sqlalchemy.orm import Session

from core.config import ALLOWED_BATCH_IMAGE_EXTENSIONS, MAX_ZIP_SIZE_BYTES, MAX_ZIP_SIZE_MB
from core.encoding import safe_print
from infrastructures.image_storage_repository import save_image_to_disk
from infrastructures.object_detection_repository import detect_objects
from repositories.detection_repository import create_detection
from services.image_processing_service import apply_clahe


def analyze_zip(
    contents: bytes,
    *,
    model_name: str,
    confidence: float,
    iou: float,
    max_det: int,
    db: Session,
):
    if len(contents) > MAX_ZIP_SIZE_BYTES:
        return 413, {
            "error": (
                f"Tệp ZIP vượt quá {MAX_ZIP_SIZE_MB}MB. "
                f"Vui lòng chọn tệp nhỏ hơn hoặc bằng {MAX_ZIP_SIZE_MB}MB."
            )
        }

    results = []

    with zipfile.ZipFile(io.BytesIO(contents)) as zf:
        invalid_files = [
            filename
            for filename in zf.namelist()
            if not filename.endswith("/") and not filename.lower().endswith(ALLOWED_BATCH_IMAGE_EXTENSIONS)
        ]
        if invalid_files:
            preview_list = ", ".join(invalid_files[:5])
            remaining_count = len(invalid_files) - 5
            suffix = f", ... và {remaining_count} tệp khác" if remaining_count > 0 else ""
            return 400, {
                "error": (
                    "ZIP chứa tệp không đúng định dạng ảnh: "
                    f"{preview_list}{suffix}. Chỉ chấp nhận PNG/JPG/JPEG."
                )
            }

        for filename in zf.namelist():
            if filename.endswith("/"):
                continue

            with zf.open(filename) as img_file:
                img_bytes = img_file.read()

            try:
                image = Image.open(io.BytesIO(img_bytes))
                if image.mode != "RGB":
                    image = image.convert("RGB")

                image_np = apply_clahe(np.array(image))
                detection_result = detect_objects(
                    image_np,
                    model_name=model_name,
                    conf=confidence,
                    iou=iou,
                    max_det=max_det,
                )

                detections = detection_result["detections"]
                annotated_img = detection_result["annotated_image"] if detections else image
                if not detections:
                    result_text = "Không phát hiện bất thường"
                else:
                    result_text = (
                        f"Phát hiện {detection_result['box_count']} vùng bất thường: "
                        f"{', '.join(detection_result['unique_classes'])}"
                    )

                original_path = save_image_to_disk(image, "orig")
                detected_path = save_image_to_disk(annotated_img, "det")

                db_detection = create_detection(
                    db,
                    filename=filename,
                    result=result_text,
                    detections=detections,
                    original_image_path=original_path,
                    detected_image_path=detected_path,
                    commit=False,
                )

                buffered = io.BytesIO()
                annotated_img.save(buffered, format="JPEG")
                detected_base64 = base64.b64encode(buffered.getvalue()).decode()

                results.append(
                    {
                        "id": db_detection.id,
                        "filename": filename,
                        "result": result_text,
                        "detections": detections,
                        "original_image": f"data:image/jpeg;base64,{base64.b64encode(img_bytes).decode()}",
                        "detected_image": f"data:image/jpeg;base64,{detected_base64}",
                    }
                )
            except Exception as exc:
                safe_print(f"Error processing file {filename}: {exc}")
                results.append(
                    {
                        "filename": filename,
                        "result": f"Error: {str(exc)}",
                        "detections": [],
                        "original_image": None,
                        "detected_image": None,
                    }
                )

    db.commit()
    return 200, {"results": results}
