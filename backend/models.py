from sqlalchemy import Column, Integer, Float, String, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone



class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True)
    filename = Column(String)
    fps = Column(Float)
    duration = Column(Float)

    detections = relationship(
        "Detection",
        back_populates="video",
        cascade="all, delete"
    )

    rois = relationship(
        "ROI",
        back_populates="video",
        cascade="all, delete"
    )

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    event = Column(String, nullable=False)
    video_id = Column(Integer, nullable=True)
    roi_id = Column(Integer, nullable=True)
    created_at = Column(
    DateTime(timezone=True),
    default=lambda: datetime.now(timezone.utc)
)





class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True)

    video_id = Column(Integer, ForeignKey("videos.id"))
    roi_id = Column(Integer, ForeignKey("rois.id"), nullable=True)

    track_id = Column(Integer)
    timestamp = Column(Float)
    x1 = Column(Float)
    y1 = Column(Float)
    x2 = Column(Float)
    y2 = Column(Float)

    video = relationship("Video", back_populates="detections")
    roi = relationship("ROI")


class ROI(Base):
    __tablename__ = "rois"

    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey("videos.id"))
    name = Column(String)
    points = Column(JSON)

    video = relationship("Video", back_populates="rois")
