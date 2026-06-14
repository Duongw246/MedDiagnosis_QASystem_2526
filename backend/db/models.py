from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, JSON, String

from db.database import Base


class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    upload_date = Column(DateTime, default=datetime.now)
    result = Column(String)
    detections = Column(JSON)
    original_image_path = Column(String)
    detected_image_path = Column(String)
    status = Column(String, default="pending")

