import cv2
import numpy as np
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models import ROI, Detection
from app.deps import get_db
from app.core.audit import log_event

router = APIRouter()


@router.get("/roi/{video_id}")
def list_rois(video_id: int, db: Session = Depends(get_db)):
    rows = db.query(ROI).filter(ROI.video_id == video_id).all()
    return [{"id": r.id, "name": r.name, "points": r.points} for r in rows]


@router.post("/roi")
def create_roi(payload: dict, db: Session = Depends(get_db)):
    roi = ROI(
        video_id=payload["video_id"],
        name=payload["name"],
        points=payload["points"],
    )

    db.add(roi)
    db.commit()
    db.refresh(roi)

    log_event(
        db,
        "roi_created",
        video_id=payload["video_id"],
        roi_id=roi.id,
    )

    poly = np.array(payload["points"], dtype=np.int32)

    dets = db.query(Detection).filter(
        Detection.video_id == payload["video_id"]
    ).all()

    for d in dets:
        cx = (d.x1 + d.x2) / 2
        cy = (d.y1 + d.y2) / 2
        if cv2.pointPolygonTest(poly, (float(cx), float(cy)), False) >= 0:
            d.roi_id = roi.id

    db.commit()

    return {"roi_id": roi.id}
