import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.routes.jobs import jobs

OUTPUT_DIR = "outputs"

router = APIRouter()


@router.get("/video/{job_id}")
def get_video(job_id: str):
    job = jobs.get(job_id)
    if not job or job.status != "done":
        raise HTTPException(status_code=404)

    path = f"{OUTPUT_DIR}/{job.job_id}.mp4"
    if not os.path.exists(path):
        raise HTTPException(status_code=404)

    return FileResponse(path, media_type="video/mp4")


@router.get("/heatmap/{job_id}")
def get_heatmap(job_id: str):
    job = jobs.get(job_id)
    if not job or job.status != "done":
        raise HTTPException(status_code=404)

    return FileResponse(
        f"{OUTPUT_DIR}/{job.job_id}.png",
        media_type="image/png",
    )
