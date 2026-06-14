import cv2
import numpy as np
from PIL import Image

from infrastructures.yolo_model_repository import load_model


def detect_objects(image_np, *, model_name: str, conf: float, iou: float, max_det: int):
    model = load_model(model_name)
    inference_results = model.predict(
        image_np,
        conf=conf,
        iou=iou,
        max_det=max_det,
        verbose=False,
    )

    result = inference_results[0]
    annotated_img_array = result.plot()
    annotated_image = Image.fromarray(cv2.cvtColor(annotated_img_array, cv2.COLOR_BGR2RGB))

    detections = []
    if result.boxes is not None:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            confidence = float(box.conf[0])
            detections.append(
                {
                    "class": model.names[cls_id],
                    "confidence": confidence,
                }
            )

    return {
        "annotated_image": annotated_image,
        "detections": detections,
        "box_count": len(result.boxes) if result.boxes is not None else 0,
        "unique_classes": list({detection["class"] for detection in detections}),
    }

