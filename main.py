from __future__ import annotations

import os
import uuid
import threading
from typing import Dict, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

from database import SessionLocal
from process_video import process_video
from models import Detection



# ------------------------
# App setup
# ------------------------
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


# ------------------------
# Job state
# ------------------------
class JobState:
    def __init__(self, job_id: str, video_path: str):
        self.job_id = job_id
        self.video_path = video_path
        self.video_id: Optional[int] = None
        self.status = "queued"   # queued | processing | done | failed
        self.error: Optional[str] = None


jobs: Dict[str, JobState] = {}


# ------------------------
# Background worker
# ------------------------
def run_processing(job: JobState):
    print(f"[JOB {job.job_id}] started")
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
        print(f"[JOB {job.job_id}] finished successfully")

    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        print(f"[JOB {job.job_id}] failed:", e)

    finally:
        db.close()



# ------------------------
# API endpoints
# ------------------------
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
    job = jobs[job_id]
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JSONResponse(
        {
            "job_id": job.job_id,
            "status": job.status,
            "video_id": job.video_id,
            "error": job.error,
        }
    )


@app.get("/video/{job_id}")
def get_video(job_id: str):
    job = jobs.get(job_id)
    if not job or job.status != "done":
        raise HTTPException(status_code=404, detail="Video not ready")

    return FileResponse(
        f"{OUTPUT_DIR}/{job.job_id}.mp4",
        media_type="video/mp4",
    )

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
def get_detections(video_id: int):
    db = SessionLocal()
    try:
        rows = (
            db.query(Detection)
            .filter(Detection.video_id == video_id)
            .order_by(Detection.timestamp)
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

