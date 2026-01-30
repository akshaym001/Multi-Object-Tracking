import { useEffect, useRef, useState } from "react";

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
  const [job, setJob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [detections, setDetections] = useState([]);
  const [jobDone, setJobDone] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const videoRef = useRef(null);

  /* -----------------------
     Upload + poll job
  ----------------------- */
  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setJob(null);
    setDetections([]);
    setJobDone(false);
    setShowHeatmap(false);

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
      const r = await fetch(`http://localhost:8000/jobs/${data.job_id}`);
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

    const fetchDetections = async () => {
      const res = await fetch(
        `http://localhost:8000/detections/${job.video_id}`
      );
      const data = await res.json();
      setDetections(data);
    };

    fetchDetections();
  }, [jobDone, job?.video_id]);

  /* -----------------------
     UI
  ----------------------- */
  return (
    <div style={styles.app}>
      <style>{globalTableStyles}</style>

      {/* HEADER */}
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>Video Analytics Dashboard</h2>

        <input
          type="file"
          accept="video/*"
          onChange={handleUpload}
          disabled={uploading}
        />

        
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        {/* VIDEO PANEL */}
        <div style={styles.videoPanel}>
          {!job && (
            <div style={styles.placeholder}>
              Upload a video to start processing
            </div>
          )}

          {job && job.status !== "done" && (
            <div style={styles.placeholder}>Processing video…</div>
          )}

          {job && job.status === "done" && (
  <div style={styles.videoBlock}>
    <div style={styles.videoWrapper}>
      <div style={styles.stack}>
        <video
          ref={videoRef}
          src={`http://localhost:8000/video/${job.job_id}`}
          controls
          style={styles.video}
        />

        {showHeatmap && (
          <img
            src={`http://localhost:8000/heatmap/${job.job_id}`}
            alt="Heatmap"
            style={styles.heatmapOverlay}
          />
        )}
      </div>
    </div>

    <div style={styles.videoControls}>
      <button
        onClick={() => setShowHeatmap((s) => !s)}
        disabled={!jobDone}
      >
        {showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
      </button>
    </div>
  </div>
)}

  
          
        </div>

        {/* TABLE PANEL */}
        <div style={styles.tablePanel}>
          <h3 style={{ textAlign: "center", color: "#000" }}>Detections</h3>

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
    </div>
  );
}

/* -----------------------
   Styles
----------------------- */
const styles = {
  app: {
    width: "100vw",
    height: "100vh",
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
    flex: 1,
    display: "flex",
    gap: 16,
    padding: 16,
    overflow: "hidden",
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
    opacity: 0.75 ,
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

  tableWrapper: {
    flex: 1,
    overflowY: "auto",
    background: "#fff",
    borderRadius: 8,
    border: "1px solid #ddd",
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
};
