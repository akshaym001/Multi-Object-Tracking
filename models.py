from sqlalchemy import Column, Integer, Float, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base

class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True)
    filename = Column(String)
    fps = Column(Float)
    duration = Column(Float)

    detections = relationship("Detection", back_populates="video", cascade="all, delete")
    rois = relationship("ROI", back_populates="video", cascade="all, delete")


class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey("videos.id"))
    track_id = Column(Integer)
    timestamp = Column(Float)
    x1 = Column(Float)
    y1 = Column(Float)
    x2 = Column(Float)
    y2 = Column(Float)

    video = relationship("Video", back_populates="detections")


class ROI(Base):
    __tablename__ = "rois"

    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey("videos.id"))
    name = Column(String)
    points = Column(JSON)

    video = relationship("Video", back_populates="rois")
    dwell = relationship("ROIDwell", back_populates="roi", cascade="all, delete")


class ROIDwell(Base):
    __tablename__ = "roi_dwell"

    id = Column(Integer, primary_key=True)
    roi_id = Column(Integer, ForeignKey("rois.id"))
    track_id = Column(Integer)
    dwell_seconds = Column(Float)

    roi = relationship("ROI", back_populates="dwell")
