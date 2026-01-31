import cv2
import numpy as np
from ultralytics import YOLO
from sqlalchemy.orm import Session

from models import Video, Detection


CONF_THRESHOLD = 0.25

HEAT_RADIUS = 20
HEAT_WEIGHT = 1.5
BLUR_KERNEL = 51


def process_video(
    video_path: str,
    output_path: str,
    db: Session,
):
    model = YOLO("yolov8n.pt")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError("Could not open input video")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps <= 0:
        fps = 25

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    out = cv2.VideoWriter(
        output_path,
        cv2.VideoWriter_fourcc(*"avc1"),
        fps,
        (width, height),
    )

    if not out.isOpened():
        cap.release()
        raise RuntimeError("Could not open VideoWriter with mp4v")

    heatmap = np.zeros((height, width), dtype=np.float32)

    video = Video(
        filename=video_path,
        fps=fps,
        duration=total_frames / fps if fps > 0 else 0,
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        draw_frame = frame.copy()

        timestamp = frame_idx / fps
        frame_idx += 1

        results = model.track(
            frame,
            persist=True,
            conf=CONF_THRESHOLD,
            tracker="bytetrack.yaml",
            verbose=False,
        )

        r = results[0]

        if r.boxes is not None:
            drawn_ids = set()

            for box in r.boxes:
                if box.id is None:
                    continue

                track_id = int(box.id)

                if track_id in drawn_ids:
                    continue

                drawn_ids.add(track_id)

                cls = int(box.cls[0])
                conf = float(box.conf[0])

                if cls != 0 or conf < CONF_THRESHOLD:
                    continue

                x1, y1, x2, y2 = map(float, box.xyxy[0])

                cx = int((x1 + x2) / 2)
                cy = int((y1 + y2) / 2)

                cv2.rectangle(
                    draw_frame,
                    (int(x1), int(y1)),
                    (int(x2), int(y2)),
                    (0, 255, 0),
                    2,
                )

                label = f"ID {track_id} | {conf:.2f}"
                cv2.putText(
                    draw_frame,
                    label,
                    (int(x1), int(y1) - 8),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 0),
                    2,
                )

                db.add(
                    Detection(
                        video_id=video.id,
                        roi_id=None,
                        track_id=track_id,
                        timestamp=timestamp,
                        x1=x1,
                        y1=y1,
                        x2=x2,
                        y2=y2,
                    )
                )

                if 0 <= cx < width and 0 <= cy < height:
                    cv2.circle(
                        heatmap,
                        (cx, cy),
                        HEAT_RADIUS,
                        HEAT_WEIGHT,
                        thickness=-1,
                    )

        out.write(draw_frame)

    cap.release()
    out.release()
    db.commit()
    cv2.destroyAllWindows()


    if np.max(heatmap) > 0:
        heatmap = cv2.GaussianBlur(
            heatmap, (BLUR_KERNEL, BLUR_KERNEL), 0
        )
        heatmap = cv2.GaussianBlur(
            heatmap, (BLUR_KERNEL, BLUR_KERNEL), 0
        )

        p99 = np.percentile(heatmap, 99)
        if p99 == 0:
            p99 = np.max(heatmap)

        heatmap = np.clip(heatmap, 0, p99)
        heatmap = (heatmap / p99 * 255).astype(np.uint8)

        heatmap_color = cv2.applyColorMap(
            heatmap, cv2.COLORMAP_JET
        )

        heatmap_path = output_path.replace(".mp4", ".png")
        cv2.imwrite(heatmap_path, heatmap_color)

    return video.id
