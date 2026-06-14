import base64
import io
import uuid

from PIL import Image

from core.config import IMAGES_DIR


def ensure_image_storage():
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def save_image_to_disk(image: Image.Image, prefix: str = "img") -> str:
    ensure_image_storage()
    filename = f"{prefix}_{uuid.uuid4().hex}.jpg"
    filepath = IMAGES_DIR / filename
    image.save(filepath, format="JPEG", quality=85)
    return f"/static/images/{filename}"


def image_to_base64(image: Image.Image) -> str:
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{img_base64}"


def image_bytes_to_base64(image_bytes: bytes) -> str:
    return f"data:image/jpeg;base64,{base64.b64encode(image_bytes).decode()}"

