from sqlalchemy import Column, Integer, String, DateTime, JSON, Text
from database import Base
from datetime import datetime

class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    upload_date = Column(DateTime, default=datetime.now)
    result = Column(String)
    detections = Column(JSON)
    original_image_path = Column(String)
    detected_image_path = Column(String)
    status = Column(String, default="pending") # 'pending' or 'approved'
