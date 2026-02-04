import os
import uuid
import threading
from typing import Dict

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session

from app.services.video_processor import JobState, run_processing
from app.core.audit import log_event
from app.deps import get_db

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"

router = APIRouter()

jobs: Dict[str, JobState] = {}

print("uploading video")
@router.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    print(file.filename)
    if not file.filename:
        raise HTTPException(status_code=400)

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".mp4", ".mov", ".mkv", ".avi"}:
        raise HTTPException(status_code=400)

    job_id = str(uuid.uuid4())
    video_path = f"{UPLOAD_DIR}/{job_id}{ext}"

    with open(video_path, "wb") as f:
        f.write(await file.read())

    job = JobState(job_id, video_path)
    jobs[job_id] = job

    log_event(db, "video_uploaded")

    def worker():
        from database import SessionLocal
        db2 = SessionLocal()
        try:
            run_processing(job, db2, f"{OUTPUT_DIR}/{job_id}.mp4")
        finally:
            db2.close()

    threading.Thread(target=worker, daemon=True).start()

    return {"job_id": job_id}


@router.get("/jobs/{job_id}")
def job_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404)

    return {
        "job_id": job.job_id,
        "status": job.status,
        "video_id": job.video_id,
        "error": job.error,
    }
