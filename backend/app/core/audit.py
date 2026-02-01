from models import AuditLog

def log_event(db, event, video_id=None, roi_id=None):
    db.add(
        AuditLog(
            event=event,
            video_id=video_id,
            roi_id=roi_id,
        )
    )
    db.commit()
