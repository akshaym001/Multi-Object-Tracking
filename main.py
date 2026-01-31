from __future__ import annotations

import os
import uuid
import threading
from typing import Dict, Optional

import cv2
import numpy as np

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from database import SessionLocal
from process_video import process_video
from models import Detection, ROI, AuditLog


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


class JobState:
    def __init__(self, job_id: str, video_path: str):
        self.job_id = job_id
        self.video_path = video_path
        self.video_id: Optional[int] = None
        self.status = "queued"
        self.error: Optional[str] = None


jobs: Dict[str, JobState] = {}

from sqlalchemy import func
from models import Detection


@app.get("/analytics/{video_id}")
def get_analytics(
    video_id: int,
    roi_id: Optional[int] = Query(None),
):
    db = SessionLocal()
    try:
        q = db.query(Detection).filter(
            Detection.video_id == video_id
        )

        if roi_id is not None:
            q = q.filter(Detection.roi_id == roi_id)

        detections = q.all()

        if not detections:
            return {
                "total_people": 0,
                "avg_dwell_time": 0,
                "peak_minute": None,
            }

        # -----------------------------
        # total people
        # -----------------------------
        track_ids = set(d.track_id for d in detections)
        total_people = len(track_ids)

        # -----------------------------
        # dwell time per person
        # -----------------------------
        by_track = {}

        for d in detections:
            by_track.setdefault(d.track_id, []).append(d.timestamp)

        dwell_times = []
        for ts in by_track.values():
            dwell_times.append(max(ts) - min(ts))

        avg_dwell_time = (
            sum(dwell_times) / len(dwell_times)
            if dwell_times else 0
        )

        # -----------------------------
        # peak minute
        # -----------------------------
        minute_counts = {}

        for d in detections:
            minute = int(d.timestamp // 60)
            minute_counts[minute] = minute_counts.get(minute, 0) + 1

        peak_minute = max(
            minute_counts,
            key=minute_counts.get
        )

        return {
            "total_people": total_people,
            "avg_dwell_time": round(avg_dwell_time, 2),
            "peak_minute": peak_minute,
        }

    finally:
        db.close()


def run_processing(job: JobState):
    db = SessionLocal()

    try:
        job.status = "processing"

        video_id = process_video(
            video_path=job.video_path,
            output_path=f"{OUTPUT_DIR}/{job.job_id}.mp4",
            db=db,
        )

        job.video_id = video_id
        job.status = "done"

    except Exception as e:
        job.status = "failed"
        job.error = str(e)

    finally:
        db.close()

@app.get("/audit-logs")
def list_audit_logs(limit: int = 100):
    db = SessionLocal()
    try:
        rows = (
            db.query(AuditLog)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "id": r.id,
                "event": r.event,
                "video_id": r.video_id,
                "roi_id": r.roi_id,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]
    finally:
        db.close()


def log_event(db, event, video_id=None, roi_id=None):
    db.add(
        AuditLog(
            event=event,
            video_id=video_id,
            roi_id=roi_id,
        )
    )
    db.commit()

@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".mp4", ".mov", ".mkv", ".avi"}:
        raise HTTPException(status_code=400, detail="Unsupported video format")

    job_id = str(uuid.uuid4())
    video_path = f"{UPLOAD_DIR}/{job_id}{ext}"

    with open(video_path, "wb") as f:
        f.write(await file.read())

    job = JobState(job_id, video_path)
    jobs[job_id] = job

    t = threading.Thread(target=run_processing, args=(job,), daemon=True)
    t.start()

    return {"job_id": job_id}


@app.get("/jobs/{job_id}")
def job_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": job.job_id,
        "status": job.status,
        "video_id": job.video_id,
        "error": job.error,
    }


@app.get("/video/{job_id}")
def get_video(job_id: str):
    job = jobs.get(job_id)
    if not job or job.status != "done":
        raise HTTPException(status_code=404, detail="Video not ready")

    path = f"{OUTPUT_DIR}/{job.job_id}.mp4"

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Video file not found")

    return FileResponse(path, media_type="video/mp4")


@app.get("/heatmap/{job_id}")
def get_heatmap(job_id: str):
    job = jobs.get(job_id)
    if not job or job.status != "done":
        raise HTTPException(status_code=404, detail="Image not ready")

    return FileResponse(
        f"{OUTPUT_DIR}/{job.job_id}.png",
        media_type="image/png",
    )


@app.get("/detections/{video_id}")
def get_detections(
    video_id: int,
    roi_id: Optional[int] = Query(None),
):
    db = SessionLocal()
    try:
        q = db.query(Detection).filter(
            Detection.video_id == video_id
        )

        if roi_id is not None:
            q = q.filter(Detection.roi_id == roi_id)

        rows = (
            q.order_by(Detection.timestamp)
            .limit(500)
            .all()
        )

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
    finally:
        db.close()


@app.get("/roi/{video_id}")
def list_rois(video_id: int):
    db = SessionLocal()
    try:
        rows = db.query(ROI).filter(ROI.video_id == video_id).all()
        return [
            {
                "id": r.id,
                "name": r.name,
                "points": r.points,
            }
            for r in rows
        ]
    finally:
        db.close()


@app.post("/roi")
def create_roi(payload: dict):
    db = SessionLocal()
    try:
        roi = ROI(
            video_id=payload["video_id"],
            name=payload["name"],
            points=payload["points"],
        )
        db.add(roi)
        db.commit()
        db.refresh(roi)

        poly = np.array(payload["points"], dtype=np.int32)

        dets = db.query(Detection).filter(
            Detection.video_id == payload["video_id"]
        ).all()

        for d in dets:
            cx = (d.x1 + d.x2) / 2.0
            cy = (d.y1 + d.y2) / 2.0

            inside = cv2.pointPolygonTest(
                poly, (float(cx), float(cy)), False
            )

            if inside >= 0:
                d.roi_id = roi.id

        db.commit()

        return {"roi_id": roi.id}

    finally:
        db.close()
