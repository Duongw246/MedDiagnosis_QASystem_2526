import os as _os_utf8_patch
import sys as _sys_utf8_patch
# Force UTF-8 I/O before any other imports (prevents 'ascii' codec errors with Vietnamese text on Windows)
_os_utf8_patch.environ.setdefault("PYTHONIOENCODING", "utf-8")
_os_utf8_patch.environ.setdefault("PYTHONUTF8", "1")
try:
    _sys_utf8_patch.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    _sys_utf8_patch.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
except Exception:
    pass

from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import uvicorn
import sys
import io
import cv2
import numpy as np
import base64
from pathlib import Path
from PIL import Image
import zipfile
import os
import torch
import uuid
import ast
import yaml
from sqlalchemy.orm import Session

import models
from rag_service import LLMs_calling
from database import SessionLocal, engine

# Ensure Vietnamese text can be printed on Windows terminals
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
except Exception:
    try:
        if hasattr(sys.stdout, "buffer"):
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="backslashreplace", line_buffering=True)
        if hasattr(sys.stderr, "buffer"):
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="backslashreplace", line_buffering=True)
    except Exception:
        pass


def safe_print(*args, **kwargs):
    """Print without crashing on misconfigured console encodings."""
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        try:
            msg = " ".join(str(a) for a in args)
            end = kwargs.get("end", "\n")
            sys.stdout.buffer.write((msg + end).encode("utf-8", errors="backslashreplace"))
        except Exception:
            pass

# Create database tables
models.Base.metadata.create_all(bind=engine)

# Patch Ultralytics to load custom weights with PyTorch 2.9+
import ultralytics.nn.tasks as tasks_module
original_torch_safe_load = tasks_module.torch_safe_load

def patched_torch_safe_load(weight):
    """Patched version to load custom weights with weights_only=False"""
    try:
        return torch.load(weight, map_location="cpu", weights_only=False), weight
    except Exception as e:
        safe_print(f"Error loading weight: {e}")
        raise

tasks_module.torch_safe_load = patched_torch_safe_load

from ultralytics import YOLO


class ChatTurn(BaseModel):
    user: str
    bot: str

class ChatRequest(BaseModel):
    question: str
    temperature: float = 0.7
    max_tokens: int = 512
    model: str = "gemini-2.5-flash-lite"
    api_key: str = None
    pinecone_api_key: str | None = None
    pinecone_index_name: str | None = None
    conversation_history: list[ChatTurn] = Field(default_factory=list)

app = FastAPI(title="XRAYAPP Backend API")


@app.on_event("startup")
async def _configure_logging_utf8():
    """Reconfigure all logging StreamHandlers to UTF-8 after uvicorn initialises them.
    Prevents 'ascii' codec UnicodeEncodeError when logging Vietnamese text on Windows.
    """
    import logging
    for _log_name in ("", "uvicorn", "uvicorn.access", "uvicorn.error", "fastapi"):
        _log = logging.getLogger(_log_name)
        for _handler in list(_log.handlers):
            _stream = getattr(_handler, "stream", None)
            if _stream is None:
                continue
            if hasattr(_stream, "reconfigure"):
                try:
                    _stream.reconfigure(encoding="utf-8", errors="backslashreplace")
                except Exception:
                    pass
            elif hasattr(_stream, "buffer"):
                try:
                    import io as _io
                    _handler.stream = _io.TextIOWrapper(
                        _stream.buffer,
                        encoding="utf-8",
                        errors="backslashreplace",
                        line_buffering=True,
                    )
                except Exception:
                    pass


MAX_ZIP_SIZE_MB = 100
MAX_ZIP_SIZE_BYTES = MAX_ZIP_SIZE_MB * 1024 * 1024
ALLOWED_BATCH_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg")
VAL_DATA_DIR = Path(__file__).parent.parent / "Val data"
VAL_IMAGES_DIR = VAL_DATA_DIR / "images"
VAL_LABELS_DIR = VAL_DATA_DIR / "labels"
VAL_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg")
_val_class_names_cache = None
_val_class_names_mtime = None
_val_label_txt_mtime = None

# Mount static files
STATIC_DIR = Path(__file__).parent / "static"
IMAGES_DIR = STATIC_DIR / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Model cache
models_cache = {}
WEIGHTS_DIR = Path(__file__).parent.parent / "frontend" / "weights"

def get_available_weight_names():
    """Collect available .pt weight file names from common project directories."""
    candidate_dirs = [
        WEIGHTS_DIR,
        Path(__file__).parent.parent / "weights",
        Path(__file__).parent / "weights",
        Path(__file__).parent,
        Path("weights"),
        Path("..").resolve() / "weights",
        Path("..").resolve() / "frontend" / "weights",
    ]

    weight_names = set()
    for directory in candidate_dirs:
        try:
            dir_path = directory.resolve() if not directory.is_absolute() else directory
            if not dir_path.exists() or not dir_path.is_dir():
                continue
            for weight_file in dir_path.glob("*.pt"):
                if weight_file.is_file():
                    weight_names.add(weight_file.name)
        except Exception:
            continue

    return sorted(weight_names)

def load_model(model_name: str = "best.pt"):
    """Load custom YOLO model weights from multiple potential locations"""
    # Normalize model names: allow callers to pass "yolov12s" instead of "yolov12s.pt".
    # This helps when some clients strip the extension.
    if model_name and "." not in model_name:
        model_name = f"{model_name}.pt"
    if model_name in models_cache:
        return models_cache[model_name]
    
    # List of potential paths to check
    potential_paths = [
        WEIGHTS_DIR / model_name,                          # frontend/weights/model.pt
        Path("weights") / model_name,                      # ./weights/model.pt
        Path(__file__).parent / "weights" / model_name,    # backend/weights/model.pt
        Path(__file__).parent / model_name,                # backend/model.pt
        Path("..") / "weights" / model_name,               # ../weights/model.pt
        Path("..") / "frontend" / "weights" / model_name,  # ../frontend/weights/model.pt
        # Also check for best.pt variants if looking for a specific model
        WEIGHTS_DIR / "best.pt",
        Path("weights") / "best.pt",
    ]

    model_path = None
    for path in potential_paths:
        if path.exists():
            model_path = path
            break
    
    if model_path:
        safe_print(f"Loading custom trained model from: {model_path}")
        try:
            # Load custom weight into YOLO model
            models_cache[model_name] = YOLO(str(model_path))
            safe_print(f"✓ Custom model {model_name} loaded successfully")
            return models_cache[model_name]
        except Exception as e:
            safe_print(f"Warning: Failed to load custom model from {model_path}: {str(e)}.")
            # Continue to fallback
    
    safe_print(f"Warning: Model file for '{model_name}' not found locally in expected paths. Attempting to load as standard model...")
    try:
        # Fallback to standard model (will attempt download if valid YOLO name)
        models_cache[model_name] = YOLO(model_name) 
        safe_print(f"✓ Standard model {model_name} loaded successfully")
        return models_cache[model_name]
    except Exception as e:
         raise Exception(f"Failed to load model '{model_name}'. Ensure the .pt file exists in 'weights/' folder or is a valid YOLO model name. Error: {str(e)}")

def save_image_to_disk(image: Image.Image, prefix: str = "img") -> str:
    """Save image to disk and return relative URL path"""
    filename = f"{prefix}_{uuid.uuid4().hex}.jpg"
    filepath = IMAGES_DIR / filename
    image.save(filepath, format="JPEG", quality=85)
    return f"/static/images/{filename}"

def apply_clahe(image_np):
    """Apply CLAHE to enhance image contrast"""
    try:
        # Check if image is grayscale or RGB
        if len(image_np.shape) == 2: # Grayscale
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            return clahe.apply(image_np)
        elif len(image_np.shape) == 3:
            # Convert to LAB
            lab = cv2.cvtColor(image_np, cv2.COLOR_RGB2LAB)
            l, a, b = cv2.split(lab)
            
            # Apply CLAHE to L-channel
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            cl = clahe.apply(l)
            
            # Merge and convert back
            limg = cv2.merge((cl, a, b))
            return cv2.cvtColor(limg, cv2.COLOR_LAB2RGB)
    except Exception as e:
        safe_print(f"Error applying CLAHE: {e}")
        return image_np
    return image_np

def image_to_base64(image: Image.Image) -> str:
    """Convert PIL image to base64 data URL."""
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{img_base64}"

def parse_yolo_labels(label_path: Path, image_width: int, image_height: int):
    """Parse YOLO txt labels into pixel coordinates."""
    boxes = []
    if not label_path.exists():
        return boxes

    with open(label_path, "r", encoding="utf-8") as f:
        for line in f:
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

            x1 = max(0, min(x1, image_width - 1))
            y1 = max(0, min(y1, image_height - 1))
            x2 = max(0, min(x2, image_width - 1))
            y2 = max(0, min(y2, image_height - 1))

            boxes.append({
                "class_id": class_id,
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2
            })

    return boxes

def draw_ground_truth_boxes(image: Image.Image, gt_boxes, class_names):
    """Draw GT boxes on image and return annotated PIL image."""
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

        cv2.rectangle(
            image_bgr,
            (box["x1"], box["y1"]),
            (box["x2"], box["y2"]),
            border_color,
            2
        )

        (text_width, text_height), baseline = cv2.getTextSize(label_text, font, font_scale, font_thickness)
        padding_x = 5
        padding_y = 3

        label_x1 = box["x1"]
        label_y2 = max(box["y1"] - 4, text_height + padding_y * 2 + baseline)
        label_y1 = label_y2 - (text_height + padding_y * 2 + baseline)
        label_x2 = min(label_x1 + text_width + padding_x * 2, image_bgr.shape[1] - 1)

        cv2.rectangle(
            image_bgr,
            (label_x1, label_y1),
            (label_x2, label_y2),
            label_bg_color,
            -1
        )

        cv2.putText(
            image_bgr,
            label_text,
            (label_x1 + padding_x, label_y2 - baseline - padding_y + 1),
            font,
            font_scale,
            text_color,
            font_thickness,
            cv2.LINE_AA
        )

    return Image.fromarray(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB))

def get_val_class_names():
    """Load class names mapping from YAML file in Val data directory."""
    global _val_class_names_cache, _val_class_names_mtime, _val_label_txt_mtime

    label_txt_path = VAL_DATA_DIR / "label.txt"
    if label_txt_path.exists():
        label_txt_mtime = label_txt_path.stat().st_mtime
        if _val_class_names_cache is not None and _val_label_txt_mtime == label_txt_mtime:
            return _val_class_names_cache

        try:
            class_names_from_txt = {}
            with open(label_txt_path, "r", encoding="utf-8") as f:
                raw_content = f.read().replace("\xa0", " ")

            # First, try dictionary-style formats, e.g.:
            # {4: 'Consolidation', 6: 'Infiltration', ...}
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

            # Fallback to line-based formats if dictionary parsing fails/empty.
            if not class_names_from_txt:
                for raw_line in raw_content.splitlines():
                    line = raw_line.strip()
                    if not line or line.startswith("#"):
                        continue

                    # Supported formats:
                    # 0 Consolidation
                    # 0: Consolidation
                    # 0=Consolidation
                    # Consolidation,0
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
        except Exception as e:
            safe_print(f"Warning: Could not load class names from label.txt ({label_txt_path}): {e}")

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
        with open(yaml_path, "r", encoding="utf-8") as f:
            yaml_data = yaml.safe_load(f) or {}

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
                    normalized_id = class_id - 1 if is_one_based else class_id
                    class_names[normalized_id] = class_name

        _val_class_names_cache = class_names
        _val_class_names_mtime = current_mtime
        _val_label_txt_mtime = label_txt_path.stat().st_mtime if label_txt_path.exists() else None
        return class_names
    except Exception as e:
        safe_print(f"Warning: Could not load class names from YAML ({yaml_path}): {e}")
        return {}

def process_image(image_bytes: bytes, model_name: str, conf: float, iou: float, max_det: int, filename: str, db: Session):
    """Process single image with YOLO detection and save to DB"""
    # Load model
    model = load_model(model_name)
    
    # Convert bytes to image
    image = Image.open(io.BytesIO(image_bytes))
    
    # Ensure image is RGB (3 channels)
    if image.mode != "RGB":
        image = image.convert("RGB")
        
    img_array = np.array(image)
    
    # Apply CLAHE enhancement
    img_array = apply_clahe(img_array)
    
    # Run inference
    results = model.predict(
        img_array,
        conf=conf,
        iou=iou,
        max_det=max_det,
        verbose=False
    )
    
    # Get results
    result = results[0]
    
    # Draw bounding boxes
    annotated_img_array = result.plot()
    annotated_img = Image.fromarray(cv2.cvtColor(annotated_img_array, cv2.COLOR_BGR2RGB))
    
    # Save images to disk
    original_path = save_image_to_disk(image, "orig")
    detected_path = save_image_to_disk(annotated_img, "det")
    
    # Convert to base64 for immediate response (optional, but good for UI responsiveness)
    buffered = io.BytesIO()
    annotated_img.save(buffered, format="JPEG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
    detected_image_base64 = f"data:image/jpeg;base64,{img_base64}"
    
    # Extract detection info
    detections = []
    if result.boxes is not None:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            confidence = float(box.conf[0])
            class_name = model.names[cls_id]
            detections.append({
                "class": class_name,
                "confidence": confidence
            })
    
    # Format result text
    if len(detections) == 0:
        result_text = "Không phát hiện bất thường"
    else:
        result_text = f"Phát hiện {len(detections)} vùng bất thường:\n"
        for det in detections:
            result_text += f"- {det['class']}: {det['confidence']*100:.1f}%\n"
    
    # Save to Database
    db_detection = models.Detection(
        filename=filename,
        result=result_text,
        detections=detections,
        original_image_path=original_path,
        detected_image_path=detected_path,
        status="pending"
    )
    db.add(db_detection)
    db.commit()
    db.refresh(db_detection)
    
    return {
        "id": db_detection.id,
        "result": result_text,
        "detected_image": detected_image_base64, # Return base64 for immediate display
        "original_image_path": original_path,
        "detected_image_path": detected_path,
        "detections": detections,
        "date": db_detection.upload_date.isoformat()
    }

@app.get("/")
async def root():
    return {"message": "XRAYAPP Backend API", "status": "running"}

@app.get("/history")
async def get_history(request: Request, db: Session = Depends(get_db)):
    """Get all detection history"""
    detections = db.query(models.Detection).order_by(models.Detection.upload_date.desc()).all()
    base_url = str(request.base_url).rstrip("/")
    
    # Convert to format expected by frontend
    history_list = []
    for det in detections:
        history_list.append({
            "id": str(det.id),
            "date": det.upload_date.strftime("%H:%M %d/%m/%Y"),
            "filename": det.filename,
            "result": det.result,
            "detections": det.detections,
            "original_image": f"{base_url}{det.original_image_path}",
            "detected_image": f"{base_url}{det.detected_image_path}",
            "status": det.status
        })
    return history_list

@app.put("/history/{id}/approve")
async def approve_detection(id: int, db: Session = Depends(get_db)):
    """Approve a detection result"""
    detection = db.query(models.Detection).filter(models.Detection.id == id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="Detection not found")
    
    detection.status = "approved"
    db.commit()
    return {"success": True}

@app.delete("/history/{id}")
async def delete_detection(id: int, db: Session = Depends(get_db)):
    """Delete a detection result"""
    detection = db.query(models.Detection).filter(models.Detection.id == id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="Detection not found")
    
    # Delete files
    try:
        if detection.original_image_path:
            orig_path = STATIC_DIR / Path(detection.original_image_path).name
            if orig_path.exists():
                os.remove(orig_path)
        if detection.detected_image_path:
            det_path = STATIC_DIR / Path(detection.detected_image_path).name
            if det_path.exists():
                os.remove(det_path)
    except Exception as e:
        safe_print(f"Error deleting files: {e}")

    db.delete(detection)
    db.commit()
    return {"success": True}

@app.delete("/history")
async def delete_all_history(status: str = None, db: Session = Depends(get_db)):
    """Delete all history, optionally filtered by status"""
    query = db.query(models.Detection)
    if status:
        query = query.filter(models.Detection.status == status)
    
    detections = query.all()
    
    for detection in detections:
        # Delete files
        try:
            if detection.original_image_path:
                orig_path = STATIC_DIR / Path(detection.original_image_path).name
                if orig_path.exists():
                    os.remove(orig_path)
            if detection.detected_image_path:
                det_path = STATIC_DIR / Path(detection.detected_image_path).name
                if det_path.exists():
                    os.remove(det_path)
        except Exception as e:
            safe_print(f"Error deleting files: {e}")
        
        db.delete(detection)
    
    db.commit()
    return {"success": True}

@app.get("/load_model")
async def load_model_endpoint(model: str = "yolo12s.pt"):
    """Pre-load YOLO model into cache"""
    try:
        loaded_model = load_model(model)
        return JSONResponse(content={
            "success": True,
            "message": f"Model YOLO12s loaded successfully",
            "model": "yolo12s.pt"
        })
    except Exception as e:
        import traceback
        safe_print(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Error loading model: {str(e)}"}
        )

@app.get("/models/weights")
async def get_available_weights():
    """Return list of available local YOLO weight names for UI model selection."""
    weights = get_available_weight_names()
    return {
        "weights": weights,
        "total": len(weights)
    }

@app.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    confidence: float = Form(0.25),
    iou: float = Form(0.45),
    max_det: int = Form(100),
    model: str = Form("best.pt"),
    db: Session = Depends(get_db)
):
    """Analyze single X-ray image"""
    try:
        # Read image
        contents = await file.read()
        
        # Process image
        result = process_image(contents, model, confidence, iou, max_det, file.filename, db)
        
        return JSONResponse(content=result)
    
    except FileNotFoundError as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=404,
            content={"error": str(e)}
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Error processing image: {str(e)}"}
        )

@app.post("/analyze_batch")
async def analyze_batch(
    file: UploadFile = File(...),
    confidence: float = Form(0.25),
    iou: float = Form(0.45),
    max_det: int = Form(100),
    model: str = Form("yolov12s.pt"),
    db: Session = Depends(get_db)
):
    """Analyze batch of X-ray images from ZIP file"""
    try:
        # Read ZIP file
        contents = await file.read()
        if len(contents) > MAX_ZIP_SIZE_BYTES:
            return JSONResponse(
                status_code=413,
                content={"error": f"Tệp ZIP vượt quá {MAX_ZIP_SIZE_MB}MB. Vui lòng chọn tệp nhỏ hơn hoặc bằng {MAX_ZIP_SIZE_MB}MB."}
            )

        # Load model (keep the original model name, e.g. "yolov12s.pt")
        # NOTE: Stripping ".pt" breaks local weight loading and the models_cache key.
        yolo_model = load_model(model)
        
        results = []
        with zipfile.ZipFile(io.BytesIO(contents)) as zf:
            invalid_files = []
            for filename in zf.namelist():
                if filename.endswith('/'):
                    continue
                if not filename.lower().endswith(ALLOWED_BATCH_IMAGE_EXTENSIONS):
                    invalid_files.append(filename)

            if invalid_files:
                preview_list = ", ".join(invalid_files[:5])
                remaining_count = len(invalid_files) - 5
                suffix = f", ... và {remaining_count} tệp khác" if remaining_count > 0 else ""
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": f"ZIP chứa tệp không đúng định dạng ảnh: {preview_list}{suffix}. Chỉ chấp nhận PNG/JPG/JPEG."
                    }
                )

            for filename in zf.namelist():
                # Skip directories
                if filename.endswith('/'):
                    continue
                
                # Read image from ZIP
                with zf.open(filename) as img_file:
                    img_bytes = img_file.read()
                
                # Process image
                try:
                    # Open and convert image
                    image = Image.open(io.BytesIO(img_bytes))
                    if image.mode != "RGB":
                        image = image.convert("RGB")
                    
                    # Run inference
                    image_np = np.array(image)
                    
                    # Apply CLAHE enhancement
                    image_np = apply_clahe(image_np)
                    
                    inference_results = yolo_model.predict(
                        image_np,
                        conf=confidence,
                        iou=iou,
                        max_det=max_det,
                        verbose=False
                    )
                    
                    # Extract detections
                    detections = []
                    result_text = "Không phát hiện bất thường"
                    
                    annotated_img = image # Default to original if no detections
                    
                    if len(inference_results) > 0 and len(inference_results[0].boxes) > 0:
                        boxes = inference_results[0].boxes
                        names = inference_results[0].names
                        
                        detected_classes = []
                        for box in boxes:
                            cls_id = int(box.cls[0])
                            conf_score = float(box.conf[0])
                            class_name = names[cls_id]
                            detected_classes.append(class_name)
                            detections.append({
                                "class": class_name,
                                "confidence": conf_score
                            })
                        
                        unique_classes = list(set(detected_classes))
                        result_text = f"Phát hiện {len(boxes)} vùng bất thường: {', '.join(unique_classes)}"
                        
                        # Draw boxes on image
                        annotated_plot = inference_results[0].plot()
                        annotated_img = Image.fromarray(cv2.cvtColor(annotated_plot, cv2.COLOR_BGR2RGB))
                    
                    # Save images to disk
                    original_path = save_image_to_disk(image, "orig")
                    detected_path = save_image_to_disk(annotated_img, "det")
                    
                    # Save to DB
                    db_detection = models.Detection(
                        filename=filename,
                        result=result_text,
                        detections=detections,
                        original_image_path=original_path,
                        detected_image_path=detected_path,
                        status="pending"
                    )
                    db.add(db_detection)
                    db.flush()  # assign db_detection.id without committing yet
                    
                    # Convert to base64 for immediate response (optional)
                    buffered = io.BytesIO()
                    annotated_img.save(buffered, format="JPEG")
                    detected_base64 = base64.b64encode(buffered.getvalue()).decode()
                    
                    results.append({
                        "id": db_detection.id,
                        "filename": filename,
                        "result": result_text,
                        "detections": detections,
                        "original_image": f"data:image/jpeg;base64,{base64.b64encode(img_bytes).decode()}", # Keep base64 for batch preview
                        "detected_image": f"data:image/jpeg;base64,{detected_base64}"
                    })
                except Exception as e:
                    safe_print(f"Error processing file {filename}: {e}")
                    results.append({
                        "filename": filename,
                        "result": f"Error: {str(e)}",
                        "detections": [],
                        "original_image": None,
                        "detected_image": None
                    })
        
        db.commit() # Commit all batch insertions
        return JSONResponse(content={"results": results})
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Error processing ZIP file: {str(e)}"}
        )

@app.get("/val_dataset/images")
async def get_val_dataset_images():
    """List available validation images and whether labels exist."""
    if not VAL_IMAGES_DIR.exists():
        return JSONResponse(
            status_code=404,
            content={"error": f"Không tìm thấy thư mục ảnh val: {VAL_IMAGES_DIR}"}
        )

    items = []
    for image_path in sorted(VAL_IMAGES_DIR.iterdir()):
        if not image_path.is_file() or image_path.suffix.lower() not in VAL_IMAGE_EXTENSIONS:
            continue

        label_path = VAL_LABELS_DIR / f"{image_path.stem}.txt"
        items.append({
            "filename": image_path.name,
            "label_exists": label_path.exists()
        })

    return {"total": len(items), "images": items}

@app.get("/val_dataset/preview")
async def preview_val_image(image_name: str):
    """Return original and ground-truth image for selected val sample (without YOLO inference)."""
    safe_name = Path(image_name).name
    image_path = VAL_IMAGES_DIR / safe_name
    if not image_path.exists() or image_path.suffix.lower() not in VAL_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy ảnh val: {safe_name}")

    try:
        original_image = Image.open(image_path)
        if original_image.mode != "RGB":
            original_image = original_image.convert("RGB")

        label_path = VAL_LABELS_DIR / f"{image_path.stem}.txt"
        gt_boxes = parse_yolo_labels(label_path, original_image.width, original_image.height)
        val_class_names = get_val_class_names()
        gt_annotated_image = draw_ground_truth_boxes(original_image.copy(), gt_boxes, val_class_names)

        return {
            "filename": safe_name,
            "ground_truth_count": len(gt_boxes),
            "original_image": image_to_base64(original_image),
            "ground_truth_image": image_to_base64(gt_annotated_image)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tải preview ảnh val: {str(e)}")

@app.post("/val_dataset/analyze")
async def analyze_val_image(
    image_name: str = Form(...),
    confidence: float = Form(0.25),
    iou: float = Form(0.45),
    max_det: int = Form(100),
    model: str = Form("best.pt")
):
    """Analyze a selected image from Val data and return side-by-side comparison assets."""
    safe_name = Path(image_name).name
    image_path = VAL_IMAGES_DIR / safe_name
    if not image_path.exists() or image_path.suffix.lower() not in VAL_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy ảnh val: {safe_name}")

    try:
        yolo_model = load_model(model)

        original_image = Image.open(image_path)
        if original_image.mode != "RGB":
            original_image = original_image.convert("RGB")

        image_np = np.array(original_image)

        inference_results = yolo_model.predict(
            image_np,
            conf=confidence,
            iou=iou,
            max_det=max_det,
            verbose=False
        )

        detection_result = inference_results[0]
        detected_plot = detection_result.plot()
        detected_image = Image.fromarray(cv2.cvtColor(detected_plot, cv2.COLOR_BGR2RGB))

        detections = []
        if detection_result.boxes is not None:
            for box in detection_result.boxes:
                cls_id = int(box.cls[0])
                conf_score = float(box.conf[0])
                class_name = yolo_model.names[cls_id]
                detections.append({
                    "class": class_name,
                    "confidence": conf_score
                })

        if len(detections) == 0:
            result_text = "Không phát hiện bất thường"
        else:
            result_text = f"Phát hiện {len(detections)} vùng bất thường"

        label_path = VAL_LABELS_DIR / f"{image_path.stem}.txt"
        gt_boxes = parse_yolo_labels(label_path, original_image.width, original_image.height)
        val_class_names = get_val_class_names()
        gt_annotated_image = draw_ground_truth_boxes(original_image.copy(), gt_boxes, val_class_names)

        return {
            "filename": safe_name,
            "result": result_text,
            "detections": detections,
            "ground_truth_count": len(gt_boxes),
            "original_image": image_to_base64(original_image),
            "ground_truth_image": image_to_base64(gt_annotated_image),
            "detected_image": image_to_base64(detected_image)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích ảnh val: {str(e)}")

@app.post("/chat")
async def chat(request: ChatRequest):
    """Chatbot endpoint - RAG system"""
    try:
        answer = LLMs_calling(
            query=request.question,
            model_name=request.model,
            api_key=request.api_key,
            pinecone_api_key=request.pinecone_api_key,
            pinecone_index_name=request.pinecone_index_name,
            conversation_history=[{"user": turn.user, "bot": turn.bot} for turn in request.conversation_history],
        )
        return JSONResponse(content={
            "answer": answer
        })
    except Exception as e:
        safe_print(f"Error in chat endpoint: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal Server Error"}
        )

if __name__ == "__main__":
    safe_print("--- Restarting Backend ---")
    safe_print(f"Weights directory: {WEIGHTS_DIR}")
    safe_print(f"Available models: {list(WEIGHTS_DIR.glob('*.pt'))}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
