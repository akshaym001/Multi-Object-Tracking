import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      style={{
        ...sidebarStyles.sidebar,
        width: collapsed ? 64 : 240,
        minWidth: collapsed ? 64 : 240,
      }}
    >
      <div style={sidebarStyles.topRow}>
        {!collapsed && (
          <div style={sidebarStyles.logo}>Video Analytics</div>
        )}

        <button
          onClick={() => setCollapsed((v) => !v)}
          style={sidebarStyles.toggleBtn}
          title="Toggle sidebar"
        >
          ☰
        </button>
      </div>

      <nav style={sidebarStyles.nav}>
        <NavLink
          to="/"
          end
          style={({ isActive }) => ({
            ...sidebarStyles.link,
            ...(isActive ? sidebarStyles.active : {}),
            justifyContent: collapsed ? "center" : "flex-start",
          })}
        >
          <span style={sidebarStyles.icon}>🏠</span>
          {!collapsed && <span>Dashboard</span>}
        </NavLink>

        <NavLink
          to="/audit"
          style={({ isActive }) => ({
            ...sidebarStyles.link,
            ...(isActive ? sidebarStyles.active : {}),
            justifyContent: collapsed ? "center" : "flex-start",
          })}
        >
          <span style={sidebarStyles.icon}>📄</span>
          {!collapsed && <span>Audit logs</span>}
        </NavLink>
      </nav>
    </aside>
  );
}


export default function AuditLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/audit-logs")
      .then((r) => r.json())
      .then(setLogs);
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <div style={{ flex: 1, padding: 24 }}>
        <h2 style={{ marginBottom: 12 }}>Audit logs</h2>

        <div
          style={{
            background: "#ffffff",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr>
                <th style={th}>Time</th>
                <th style={th}>Event</th>
                <th style={th}>Video</th>
                <th style={th}>ROI</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td style={td}>
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td style={td}>{l.event}</td>
                  <td style={td}>{l.video_id ?? "-"}</td>
                  <td style={td}>{l.roi_id ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {logs.length === 0 && (
            <div style={{ padding: 16, color: "#666" }}>
              No audit logs yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const th = {
  textAlign: "left",
  padding: "10px 12px",
  background: "#f9fafb",
  borderBottom: "1px solid #e5e7eb",
};

const td = {
  padding: "10px 12px",
  borderBottom: "1px solid #f0f0f0",
};

const sidebarStyles = {
  sidebar: {
    background: "#0f172a",
    color: "#fff",
    padding: "10px 8px",
    display: "flex",
    flexDirection: "column",
    transition: "width 0.2s ease",
  },

  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 6px 12px 6px",
  },

  logo: {
    fontSize: 16,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  toggleBtn: {
    background: "transparent",
    border: "none",
    color: "#cbd5f5",
    cursor: "pointer",
    fontSize: 18,
    padding: 4,
  },

  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  link: {
    textDecoration: "none",
    color: "#cbd5f5",
    padding: "10px 10px",
    borderRadius: 8,
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: 10,
    whiteSpace: "nowrap",
  },

  icon: {
    fontSize: 16,
    width: 20,
    textAlign: "center",
  },

  active: {
    background: "#1e293b",
    color: "#fff",
  },
};

