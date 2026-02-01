from typing import Optional
from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session

from models import Detection
from app.deps import get_db

router = APIRouter()


@router.get("/analytics/{video_id}")
def get_analytics(
    video_id: int,
    roi_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Detection).filter(Detection.video_id == video_id)

    if roi_id is not None:
        q = q.filter(Detection.roi_id == roi_id)

    detections = q.all()

    if not detections:
        return {
            "total_people": 0,
            "avg_dwell_time": 0,
            "peak_minute": None,
        }

    track_ids = set(d.track_id for d in detections)

    by_track = {}
    for d in detections:
        by_track.setdefault(d.track_id, []).append(d.timestamp)

    dwell_times = [max(ts) - min(ts) for ts in by_track.values()]

    minute_counts = {}
    for d in detections:
        m = int(d.timestamp // 60)
        minute_counts[m] = minute_counts.get(m, 0) + 1

    return {
        "total_people": len(track_ids),
        "avg_dwell_time": round(sum(dwell_times) / len(dwell_times), 2),
        "peak_minute": max(minute_counts, key=minute_counts.get),
    }
