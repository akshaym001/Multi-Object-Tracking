from typing import Optional
from process_video import process_video
from app.core.audit import log_event


class JobState:
    def __init__(self, job_id: str, video_path: str):
        self.job_id = job_id
        self.video_path = video_path
        self.video_id: Optional[int] = None
        self.status = "queued"
        self.error: Optional[str] = None


def run_processing(job, db, output_path: str):
    try:
        job.status = "processing"

        video_id = process_video(
            video_path=job.video_path,
            output_path=output_path,
            db=db,
        )

        job.video_id = video_id
        job.status = "done"

        log_event(db, "video_processed", video_id=video_id)

    except Exception as e:
        job.status = "failed"
        job.error = str(e)

        log_event(db, "video_processing_failed")
