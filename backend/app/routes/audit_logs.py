from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models import AuditLog
from app.deps import get_db

router = APIRouter()


@router.get("/audit-logs")
def list_audit_logs(limit: int = 100, db: Session = Depends(get_db)):
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
