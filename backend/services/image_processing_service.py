import cv2
import numpy as np

from core.encoding import safe_print


def apply_clahe(image_np):
    try:
        if len(image_np.shape) == 2:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            return clahe.apply(image_np)
        if len(image_np.shape) == 3:
            lab = cv2.cvtColor(image_np, cv2.COLOR_RGB2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            limg = cv2.merge((cl, a, b))
            return cv2.cvtColor(limg, cv2.COLOR_LAB2RGB)
    except Exception as exc:
        safe_print(f"Error applying CLAHE: {exc}")
        return image_np
    return image_np


def format_detection_text(detections: list[dict]) -> str:
    if len(detections) == 0:
        return "Không phát hiện bất thường"

    result_text = f"Phát hiện {len(detections)} vùng bất thường:\n"
    for detection in detections:
        result_text += f"- {detection['class']}: {detection['confidence'] * 100:.1f}%\n"
    return result_text
