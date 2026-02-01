import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db


from app.routes import (
    analytics,
    audit_logs,
    jobs,
    media,
    detections,
    roi,
)



UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

app = FastAPI()

@app.on_event("startup")
def on_startup():
    init_db()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics.router)
app.include_router(audit_logs.router)
app.include_router(jobs.router)
app.include_router(media.router)
app.include_router(detections.router)
app.include_router(roi.router)
