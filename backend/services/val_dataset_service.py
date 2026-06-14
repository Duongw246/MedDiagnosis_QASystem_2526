import ast
from pathlib import Path

import cv2
import numpy as np
import yaml
from fastapi import HTTPException
from PIL import Image

from core.config import VAL_DATA_DIR, VAL_IMAGE_EXTENSIONS, VAL_IMAGES_DIR, VAL_LABELS_DIR
from core.encoding import safe_print
from infrastructures.image_storage_repository import image_to_base64
from infrastructures.object_detection_repository import detect_objects


_val_class_names_cache = None
_val_class_names_mtime = None
_val_label_txt_mtime = None


def parse_yolo_labels(label_path: Path, image_width: int, image_height: int):
    boxes = []
    if not label_path.exists():
        return boxes

    with open(label_path, "r", encoding="utf-8") as file:
        for line in file:
            parts = line.strip().split()
            if len(parts) < 5:
                continue
            try:
                class_id = int(float(parts[0]))
                x_center = float(parts[1])
                y_center = float(parts[2])
                width = float(parts[3])
                height = float(parts[4])
            except ValueError:
                continue

            x1 = int((x_center - width / 2) * image_width)
            y1 = int((y_center - height / 2) * image_height)
            x2 = int((x_center + width / 2) * image_width)
            y2 = int((y_center + height / 2) * image_height)

            boxes.append(
                {
                    "class_id": class_id,
                    "x1": max(0, min(x1, image_width - 1)),
                    "y1": max(0, min(y1, image_height - 1)),
                    "x2": max(0, min(x2, image_width - 1)),
                    "y2": max(0, min(y2, image_height - 1)),
                }
            )

    return boxes


def draw_ground_truth_boxes(image: Image.Image, gt_boxes, class_names):
    image_bgr = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

    for box in gt_boxes:
        class_id = box["class_id"]
        label = class_names.get(class_id, str(class_id)) if isinstance(class_names, dict) else str(class_id)
        label_text = f"GT: {label}"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.52
        font_thickness = 1
        text_color = (255, 255, 255)
        label_bg_color = (34, 139, 34)
        border_color = (34, 139, 34)

        cv2.rectangle(image_bgr, (box["x1"], box["y1"]), (box["x2"], box["y2"]), border_color, 2)

        (text_width, text_height), baseline = cv2.getTextSize(label_text, font, font_scale, font_thickness)
        padding_x = 5
        padding_y = 3
        label_x1 = box["x1"]
        label_y2 = max(box["y1"] - 4, text_height + padding_y * 2 + baseline)
        label_y1 = label_y2 - (text_height + padding_y * 2 + baseline)
        label_x2 = min(label_x1 + text_width + padding_x * 2, image_bgr.shape[1] - 1)

        cv2.rectangle(image_bgr, (label_x1, label_y1), (label_x2, label_y2), label_bg_color, -1)
        cv2.putText(
            image_bgr,
            label_text,
            (label_x1 + padding_x, label_y2 - baseline - padding_y + 1),
            font,
            font_scale,
            text_color,
            font_thickness,
            cv2.LINE_AA,
        )

    return Image.fromarray(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB))


def get_val_class_names():
    global _val_class_names_cache, _val_class_names_mtime, _val_label_txt_mtime

    label_txt_path = VAL_DATA_DIR / "label.txt"
    if label_txt_path.exists():
        label_txt_mtime = label_txt_path.stat().st_mtime
        if _val_class_names_cache is not None and _val_label_txt_mtime == label_txt_mtime:
            return _val_class_names_cache

        try:
            class_names_from_txt = {}
            with open(label_txt_path, "r", encoding="utf-8") as file:
                raw_content = file.read().replace("\xa0", " ")

            parsed_dict = None
            try:
                parsed_candidate = ast.literal_eval(raw_content)
                if isinstance(parsed_candidate, dict):
                    parsed_dict = parsed_candidate
            except Exception:
                try:
                    parsed_candidate = yaml.safe_load(raw_content)
                    if isinstance(parsed_candidate, dict):
                        parsed_dict = parsed_candidate
                except Exception:
                    parsed_dict = None

            if isinstance(parsed_dict, dict):
                for key, value in parsed_dict.items():
                    try:
                        class_id = int(key)
                    except (TypeError, ValueError):
                        continue
                    class_name = str(value).strip().strip("\"'")
                    if class_name:
                        class_names_from_txt[class_id] = class_name

            if not class_names_from_txt:
                for raw_line in raw_content.splitlines():
                    line = raw_line.strip()
                    if not line or line.startswith("#"):
                        continue
                    class_id = None
                    class_name = None
                    if ":" in line:
                        left, right = line.split(":", 1)
                        if left.strip().isdigit():
                            class_id = int(left.strip())
                            class_name = right.strip()
                    elif "=" in line:
                        left, right = line.split("=", 1)
                        if left.strip().isdigit():
                            class_id = int(left.strip())
                            class_name = right.strip()
                    elif "," in line:
                        left, right = line.split(",", 1)
                        if left.strip().isdigit():
                            class_id = int(left.strip())
                            class_name = right.strip()
                        elif right.strip().isdigit():
                            class_id = int(right.strip())
                            class_name = left.strip()
                    else:
                        parts = line.split(None, 1)
                        if len(parts) == 2 and parts[0].isdigit():
                            class_id = int(parts[0])
                            class_name = parts[1].strip()

                    if class_id is not None and class_name:
                        class_names_from_txt[class_id] = class_name

            if class_names_from_txt:
                _val_class_names_cache = class_names_from_txt
                _val_label_txt_mtime = label_txt_mtime
                _val_class_names_mtime = None
                return class_names_from_txt
        except Exception as exc:
            safe_print(f"Warning: Could not load class names from label.txt ({label_txt_path}): {exc}")

    preferred_yaml = VAL_DATA_DIR / "data.yaml"
    preferred_yml = VAL_DATA_DIR / "data.yml"
    if preferred_yaml.exists():
        yaml_candidates = [preferred_yaml]
    elif preferred_yml.exists():
        yaml_candidates = [preferred_yml]
    else:
        yaml_candidates = sorted(list(VAL_DATA_DIR.glob("*.yaml")) + list(VAL_DATA_DIR.glob("*.yml")))

    if not yaml_candidates:
        return {}

    yaml_path = yaml_candidates[0]
    current_mtime = yaml_path.stat().st_mtime
    if _val_class_names_cache is not None and _val_class_names_mtime == current_mtime:
        return _val_class_names_cache

    try:
        with open(yaml_path, "r", encoding="utf-8") as file:
            yaml_data = yaml.safe_load(file) or {}

        names_data = yaml_data.get("names", {})
        nc_value = yaml_data.get("nc")
        class_names = {}
        if isinstance(names_data, list):
            for idx, name in enumerate(names_data):
                class_names[idx] = str(name)
        elif isinstance(names_data, dict):
            parsed_pairs = []
            for key, value in names_data.items():
                try:
                    class_id = int(key)
                except (TypeError, ValueError):
                    continue
                parsed_pairs.append((class_id, str(value)))
            if parsed_pairs:
                key_ids = sorted(class_id for class_id, _ in parsed_pairs)
                is_one_based = (
                    key_ids[0] == 1
                    and all((idx + 1) == key for idx, key in enumerate(key_ids))
                    and (nc_value is None or int(nc_value) == len(parsed_pairs))
                )
                for class_id, class_name in parsed_pairs:
                    class_names[class_id - 1 if is_one_based else class_id] = class_name

        _val_class_names_cache = class_names
        _val_class_names_mtime = current_mtime
        _val_label_txt_mtime = label_txt_path.stat().st_mtime if label_txt_path.exists() else None
        return class_names
    except Exception as exc:
        safe_print(f"Warning: Could not load class names from YAML ({yaml_path}): {exc}")
        return {}


def list_val_images():
    if not VAL_IMAGES_DIR.exists():
        return 404, {"error": f"Không tìm thấy thư mục ảnh val: {VAL_IMAGES_DIR}"}

    items = []
    for image_path in sorted(VAL_IMAGES_DIR.iterdir()):
        if not image_path.is_file() or image_path.suffix.lower() not in VAL_IMAGE_EXTENSIONS:
            continue
        label_path = VAL_LABELS_DIR / f"{image_path.stem}.txt"
        items.append({"filename": image_path.name, "label_exists": label_path.exists()})
    return 200, {"total": len(items), "images": items}


def preview_val_image(image_name: str):
    safe_name = Path(image_name).name
    image_path = VAL_IMAGES_DIR / safe_name
    if not image_path.exists() or image_path.suffix.lower() not in VAL_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy ảnh val: {safe_name}")

    original_image = Image.open(image_path)
    if original_image.mode != "RGB":
        original_image = original_image.convert("RGB")

    label_path = VAL_LABELS_DIR / f"{image_path.stem}.txt"
    gt_boxes = parse_yolo_labels(label_path, original_image.width, original_image.height)
    gt_annotated_image = draw_ground_truth_boxes(original_image.copy(), gt_boxes, get_val_class_names())
    return {
        "filename": safe_name,
        "ground_truth_count": len(gt_boxes),
        "original_image": image_to_base64(original_image),
        "ground_truth_image": image_to_base64(gt_annotated_image),
    }


def analyze_val_image(image_name: str, confidence: float, iou: float, max_det: int, model_name: str):
    safe_name = Path(image_name).name
    image_path = VAL_IMAGES_DIR / safe_name
    if not image_path.exists() or image_path.suffix.lower() not in VAL_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy ảnh val: {safe_name}")

    original_image = Image.open(image_path)
    if original_image.mode != "RGB":
        original_image = original_image.convert("RGB")

    detection_result = detect_objects(
        np.array(original_image),
        model_name=model_name,
        conf=confidence,
        iou=iou,
        max_det=max_det,
    )
    detected_image = detection_result["annotated_image"]
    detections = detection_result["detections"]

    result_text = "Không phát hiện bất thường" if len(detections) == 0 else f"Phát hiện {len(detections)} vùng bất thường"

    label_path = VAL_LABELS_DIR / f"{image_path.stem}.txt"
    gt_boxes = parse_yolo_labels(label_path, original_image.width, original_image.height)
    gt_annotated_image = draw_ground_truth_boxes(original_image.copy(), gt_boxes, get_val_class_names())

    return {
        "filename": safe_name,
        "result": result_text,
        "detections": detections,
        "ground_truth_count": len(gt_boxes),
        "original_image": image_to_base64(original_image),
        "ground_truth_image": image_to_base64(gt_annotated_image),
        "detected_image": image_to_base64(detected_image),
    }
