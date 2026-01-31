import { useEffect, useState } from "react";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetch("http://localhost:8000/audit-logs")
      .then(r => r.json())
      .then(setLogs);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Audit logs</h2>

      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Event</th>
            <th>Video</th>
            <th>ROI</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(l => (
            <tr key={l.id}>
              <td>{new Date(l.created_at).toLocaleString()}</td>
              <td>{l.event}</td>
              <td>{l.video_id ?? "-"}</td>
              <td>{l.roi_id ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
