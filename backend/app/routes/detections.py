from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from models import Detection
from app.deps import get_db

router = APIRouter()


@router.get("/detections/{video_id}")
def get_detections(
    video_id: int,
    roi_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Detection).filter(Detection.video_id == video_id)

    if roi_id is not None:
        q = q.filter(Detection.roi_id == roi_id)

    rows = q.order_by(Detection.timestamp).limit(500).all()

    return [
        {
            "track_id": d.track_id,
            "timestamp": round(d.timestamp, 2),
            "x1": round(d.x1, 1),
            "y1": round(d.y1, 1),
            "x2": round(d.x2, 1),
            "y2": round(d.y2, 1),
        }
        for d in rows
    ]
