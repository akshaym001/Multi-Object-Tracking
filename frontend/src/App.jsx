import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { create } from "zustand";

/* ======================================================
   ZUSTAND STORE
====================================================== */

const useDashboardStore = create((set) => ({
  job: null,
  detections: [],
  jobDone: false,
  showHeatmap: false,

  analytics: null,
  rois: [],
  selectedROI: "",

  setJob: (job) => set({ job }),
  setDetections: (detections) => set({ detections }),
  setJobDone: (jobDone) => set({ jobDone }),
  setShowHeatmap: (showHeatmap) => set({ showHeatmap }),

  setAnalytics: (analytics) => set({ analytics }),
  setRois: (rois) => set({ rois }),
  setSelectedROI: (selectedROI) => set({ selectedROI }),

  resetForNewUpload: () =>
    set({
      job: null,
      detections: [],
      jobDone: false,
      showHeatmap: false,
      analytics: null,
      rois: [],
      selectedROI: "",
    }),
}));

/* -----------------------
   Global table styles
----------------------- */
const globalTableStyles = `
table thead th {
  position: sticky;
  top: 0;
  background: #f5f5f5;
  z-index: 1;
  text-align: left;
  padding: 10px;
  color: #000;
  border-bottom: 1px solid #ddd;
}

table tbody td {
  padding: 10px;
  border-bottom: 1px solid #eee;
  color: #000;
}

table tbody tr:nth-child(even) {
  background: #fafafa;
}

table tbody tr:hover {
  background: #e8f0fe;
  cursor: pointer;
}
`;

export default function App() {
  const uploadingRef = useRef(false);

  const job = useDashboardStore((s) => s.job);
  const detections = useDashboardStore((s) => s.detections);
  const jobDone = useDashboardStore((s) => s.jobDone);
  const showHeatmap = useDashboardStore((s) => s.showHeatmap);
  const analytics = useDashboardStore((s) => s.analytics);
  const rois = useDashboardStore((s) => s.rois);
  const selectedROI = useDashboardStore((s) => s.selectedROI);

  const setJob = useDashboardStore((s) => s.setJob);
  const setDetections = useDashboardStore((s) => s.setDetections);
  const setJobDone = useDashboardStore((s) => s.setJobDone);
  const setShowHeatmap = useDashboardStore((s) => s.setShowHeatmap);
  const setAnalytics = useDashboardStore((s) => s.setAnalytics);
  const setRois = useDashboardStore((s) => s.setRois);
  const setSelectedROI = useDashboardStore((s) => s.setSelectedROI);
  const resetForNewUpload = useDashboardStore(
    (s) => s.resetForNewUpload
  );

  const [uploading, setUploading] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [drawingROI, setDrawingROI] = useState(false);
  const [roiPoints, setRoiPoints] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  /* -----------------------
     Upload + poll job
  ----------------------- */
  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    resetForNewUpload();

    setUploading(true);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("http://localhost:8000/upload", {
      method: "POST",
      body: form,
    });

    const data = await res.json();
    setJob({ job_id: data.job_id, status: "queued" });

    setUploading(false);

    const interval = setInterval(async () => {
      const r = await fetch(
        `http://localhost:8000/jobs/${data.job_id}`
      );
      const j = await r.json();
      setJob(j);

      if (j.status === "done") {
        setJobDone(true);
        clearInterval(interval);
      }

      if (j.status === "failed") {
        clearInterval(interval);
      }
    }, 1000);
  }

  /* -----------------------
     Fetch detections
  ----------------------- */
  useEffect(() => {
    if (!jobDone || !job?.video_id) return;

    const url =
      selectedROI === ""
        ? `http://localhost:8000/detections/${job.video_id}`
        : `http://localhost:8000/detections/${job.video_id}?roi_id=${selectedROI}`;

    fetch(url)
      .then((r) => r.json())
      .then(setDetections);
  }, [jobDone, job?.video_id, selectedROI]);

  /* -----------------------
     Fetch analytics
  ----------------------- */
  useEffect(() => {
    if (!jobDone || !job?.video_id) return;

    const url =
      selectedROI === ""
        ? `http://localhost:8000/analytics/${job.video_id}`
        : `http://localhost:8000/analytics/${job.video_id}?roi_id=${selectedROI}`;

    const fetchAnalytics = async () => {
      try {
        setLoadingAnalytics(true);
        const res = await fetch(url);
        const data = await res.json();
        setAnalytics(data);
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchAnalytics();
  }, [jobDone, job?.video_id, selectedROI]);

  /* -----------------------
     Fetch ROIs
  ----------------------- */
  useEffect(() => {
    if (!jobDone || !job?.video_id) return;

    fetch(`http://localhost:8000/roi/${job.video_id}`)
      .then((r) => r.json())
      .then(setRois);
  }, [jobDone, job?.video_id]);

  function buildPeopleVsTime(detections) {
    if (!detections || detections.length === 0) return [];

    const bySecond = new Map();

    detections.forEach((d) => {
      const t = Math.floor(d.timestamp);
      if (!bySecond.has(t)) bySecond.set(t, new Set());
      bySecond.get(t).add(d.track_id);
    });

    const seconds = [...bySecond.keys()].sort((a, b) => a - b);

    const seen = new Set();
    const series = [];

    seconds.forEach((sec) => {
      const ids = bySecond.get(sec);
      ids.forEach((id) => seen.add(id));
      series.push({ t: sec, count: seen.size });
    });

    return series;
  }

  function PeopleGraph({ data }) {
    if (!data || data.length < 2) {
      return <div style={{ color: "#666" }}>Not enough data</div>;
    }

    const width = 900;
    const height = 260;
    const padding = 40;

    const maxX = data[data.length - 1].t;
    const maxY = Math.max(...data.map((d) => d.count));

    const scaleX = (x) =>
      padding + (x / maxX) * (width - padding * 2);

    const scaleY = (y) =>
      height - padding - (y / maxY) * (height - padding * 2);

    const path = data
      .map((d, i) => {
        const x = scaleX(d.t);
        const y = scaleY(d.count);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

    return (
      <svg width={width} height={height}>
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#000"
        />
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#000"
        />
        <path
          d={path}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
        />
      </svg>
    );
  }

  /* -----------------------
     ROI drawing helpers
  ----------------------- */

  function getDisplayedVideoRect(video) {
    const videoRatio = video.videoWidth / video.videoHeight;
    const elementRatio = video.clientWidth / video.clientHeight;

    let width, height, offsetX, offsetY;

    if (videoRatio > elementRatio) {
      width = video.clientWidth;
      height = width / videoRatio;
      offsetX = 0;
      offsetY = (video.clientHeight - height) / 2;
    } else {
      height = video.clientHeight;
      width = height * videoRatio;
      offsetX = (video.clientWidth - width) / 2;
      offsetY = 0;
    }

    return { width, height, offsetX, offsetY };
  }

  function syncCanvasSize() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || v.videoWidth === 0) return;

    const { width, height, offsetX, offsetY } =
      getDisplayedVideoRect(v);

    c.width = width;
    c.height = height;
    c.style.left = `${offsetX}px`;
    c.style.top = `${offsetY}px`;

    redrawROI();
  }

  function handleCanvasClick(e) {
    if (!drawingROI) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setRoiPoints((p) => [...p, [x, y]]);
  }

  function redrawROI() {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.videoWidth === 0) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;

    rois.forEach((roiObj) => {
      const pts = roiObj.points;
      if (!pts || pts.length < 3) return;

      ctx.beginPath();
      ctx.moveTo(pts[0][0] * scaleX, pts[0][1] * scaleY);

      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0] * scaleX, pts[i][1] * scaleY);
      }

      ctx.closePath();

      ctx.fillStyle = "rgba(0,180,0,0.25)";
      ctx.fill();

      ctx.strokeStyle = "#00aa00";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    if (roiPoints.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(roiPoints[0][0], roiPoints[0][1]);

      for (let i = 1; i < roiPoints.length; i++) {
        ctx.lineTo(roiPoints[i][0], roiPoints[i][1]);
      }

      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  useEffect(() => {
    redrawROI();
  }, [roiPoints, drawingROI, rois]);

  async function finishROI() {
    if (!job?.video_id || roiPoints.length < 3) return;

    const name = prompt("ROI name:");
    if (!name) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    const scaleX = video.videoWidth / width;
    const scaleY = video.videoHeight / height;

    const videoPoints = roiPoints.map(([x, y]) => [
      x * scaleX,
      y * scaleY,
    ]);

    await fetch("http://localhost:8000/roi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: job.video_id,
        name,
        points: videoPoints,
      }),
    });

    setDrawingROI(false);

    const r = await fetch(
      `http://localhost:8000/roi/${job.video_id}`
    );
    setRois(await r.json());
  }

  /* -----------------------
     UI
  ----------------------- */

  return (
    <div style={styles.app}>
      <style>{globalTableStyles}</style>

      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>Video Analytics Dashboard</h2>

        <input
          type="file"
          accept="video/*"
          onChange={handleUpload}
          disabled={uploading}
        />

        <Link to="/audit">Audit logs</Link>
      </div>

      <div style={styles.main}>
        <div style={styles.videoPanel}>
          {!job && (
            <div style={styles.placeholder}>
              Upload a video to start processing
            </div>
          )}

          {job && job.status === "processing" && (
            <div style={styles.placeholder}>Processing video…</div>
          )}

          {job && job.status === "done" && (
            <div style={styles.videoBlock}>
              <div style={styles.videoWrapper}>
                <div style={styles.stack}>
                  <video
                    ref={videoRef}
                    src={`http://localhost:8000/video/${job.job_id}`}
                    controls={!drawingROI}
                    style={{
                      ...styles.video,
                      pointerEvents: drawingROI ? "none" : "auto",
                    }}
                    onLoadedMetadata={syncCanvasSize}
                  />

                  {showHeatmap && (
                    <img
                      src={`http://localhost:8000/heatmap/${job.job_id}`}
                      alt="Heatmap"
                      style={styles.heatmapOverlay}
                    />
                  )}

                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    style={{
                      ...styles.roiCanvas,
                      pointerEvents: drawingROI ? "auto" : "none",
                      cursor: drawingROI ? "crosshair" : "default",
                    }}
                  />
                </div>
              </div>

              <div style={styles.videoControls}>
                <button onClick={() => setShowHeatmap(!showHeatmap)}>
                  {showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
                </button>

                <button
                  onClick={() => {
                    setDrawingROI(true);
                    setRoiPoints([]);
                  }}
                >
                  Draw ROI
                </button>

                <button
                  disabled={roiPoints.length < 3}
                  onClick={finishROI}
                >
                  Finish ROI
                </button>
              </div>
            </div>
          )}

          {job && job.status === "failed" && (
            <div style={styles.placeholder}>
              Processing failed. Check backend logs.
            </div>
          )}
        </div>

        <div style={styles.tablePanel}>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 13, color: "#444" }}>
              Region
            </label>
            <select
              value={selectedROI}
              onChange={(e) => setSelectedROI(e.target.value)}
              style={{ width: "100%", marginTop: 4 }}
            >
              <option value="">All regions</option>
              {rois.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.analyticsBlock}>
            <h3 style={{ margin: "0 0 10px 0", color: "#000" }}>
              Analytics
            </h3>

            {!analytics && loadingAnalytics && (
              <div style={{ color: "#666" }}>
                Loading analytics…
              </div>
            )}

            {analytics && (
              <div style={styles.cardsRow}>
                <div style={styles.card}>
                  <div style={styles.cardLabel}>Total people</div>
                  <div style={styles.cardValue}>
                    {analytics.total_people}
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardLabel}>Avg dwell time</div>
                  <div style={styles.cardValue}>
                    {analytics.avg_dwell_time}s
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardLabel}>Peak minute</div>
                  <div style={styles.cardValue}>
                    {analytics.peak_minute ?? "-"}
                  </div>
                </div>
              </div>
            )}
          </div>

          <h3
            style={{
              textAlign: "center",
              color: "#000",
              marginTop: 10,
            }}
          >
            Detections
          </h3>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Track ID</th>
                  <th>Time (s)</th>
                  <th>Bounding Box</th>
                </tr>
              </thead>
              <tbody>
                {detections.map((d, i) => (
                  <tr key={i}>
                    <td style={styles.mono}>{d.track_id}</td>
                    <td>{d.timestamp}</td>
                    <td style={styles.mono}>
                      ({d.x1},{d.y1}) → ({d.x2},{d.y2})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {job && job.status === "done" && (
        <div style={styles.graphSection}>
          <h3 style={{ color: "#000", marginBottom: 10 }}>
            Total people vs time
          </h3>

          <PeopleGraph
            data={buildPeopleVsTime(detections)}
          />
        </div>
      )}
    </div>
  );
}

/* -----------------------
   Styles
----------------------- */

const styles = {
  app: {
    width: "100vw",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, sans-serif",
  },
  header: {
    padding: "12px 20px",
    borderBottom: "1px solid #ddd",
    display: "flex",
    alignItems: "center",
    gap: 20,
  },
  main: {
    display: "flex",
    gap: 16,
    padding: 16,
  },
  videoBlock: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },
  videoControls: {
    marginTop: 8,
    display: "flex",
    justifyContent: "center",
    gap: 8,
  },
  videoPanel: {
    flex: 3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  videoWrapper: {
    position: "relative",
    flex: 1,
    height: "100%",
  },
  stack: {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    border: "2px dashed #ccc",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    color: "#666",
  },
  video: {
    gridArea: "1 / 1",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    background: "#000",
    borderRadius: 10,
  },
  heatmapOverlay: {
    gridArea: "1 / 1",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    pointerEvents: "none",
    opacity: 0.6,
  },
  roiCanvas: {
    position: "absolute",
  },
  tablePanel: {
    flex: 1,
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: 12,
    background: "#fafafa",
    display: "flex",
    flexDirection: "column",
  },
  analyticsBlock: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
  },
  cardsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "10px 12px",
    background: "#f9fafb",
  },
  cardLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: 600,
    color: "#111",
  },
  tableWrapper: {
    maxHeight: 450,
    overflowY: "auto",
    background: "#fff",
    borderRadius: 8,
    border: "1px solid #ddd",
    marginTop: 8,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  mono: {
    fontFamily: "ui-monospace, monospace",
    fontSize: 13,
  },
  graphSection: {
    padding: "20px 30px 40px 30px",
    borderTop: "1px solid #ddd",
    background: "#fff",
  },
};
