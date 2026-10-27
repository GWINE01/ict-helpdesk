"use client";

// ICT admin: statistics. Every number is calculated by SQL in the backend.

import { useEffect, useState } from "react";
import { StatusPill } from "@/components/Pills";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";
import { formatHours, STATUSES } from "@/lib/format";

function Reports() {
  const [days, setDays] = useState("");
  const [report, setReport] = useState(null);

  useEffect(() => {
    api("/reports" + (days ? `?days=${days}` : "")).then(setReport);
  }, [days]);

  if (!report) return <main className="page"><p className="muted">Loading...</p></main>;

  // The longest bar belongs to the biggest category; the others are scaled to it.
  const biggest = Math.max(1, ...report.by_category.map((c) => c.total));

  return (
    <main className="page">
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <h1>Reports</h1>
        <div className="row no-print" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ flex: "none", width: 180 }}>
            <label htmlFor="period">Period</label>
            <select id="period" className="select" value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="">All time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          <button className="btn btn-secondary btn-small" onClick={() => window.print()}>Print report</button>
        </div>
      </div>

      <div className="grid-auto">
        <div className="tile"><div className="tile-label">Total requests</div><div className="tile-value">{report.total}</div></div>
        <div className="tile"><div className="tile-label">Resolved or closed</div><div className="tile-value">{report.resolved}</div></div>
        <div className="tile"><div className="tile-label">Average resolution time</div><div className="tile-value">{formatHours(report.avg_resolution_hours)}</div></div>
        <div className="tile"><div className="tile-label">Open right now</div><div className="tile-value">{report.open}</div></div>
      </div>

      <div className="split" style={{ alignItems: "stretch" }}>
        <section className="card column main" style={{ gap: 18 }}>
          <h2>Requests by category</h2>
          <div className="column" style={{ gap: 14 }}>
            {report.by_category.map((c) => (
              <div className="bar-row" key={c.category}>
                <div className="label"><span>{c.category}</span><b>{c.total}</b></div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(c.total / biggest) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card column side" style={{ gap: 14 }}>
          <h2>Requests by status</h2>
          <ul className="status-list">
            {STATUSES.map((status) => (
              <li key={status}>
                <StatusPill status={status} />
                <b>{report.by_status[status] || 0}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card column" style={{ gap: 12 }}>
        <h2>Technician workload</h2>
        <div className="table-wrap">
          <table style={{ minWidth: 560 }}>
            <thead>
              <tr><th>Technician</th><th>Assigned</th><th>Resolved</th><th>Still open</th><th>Average resolution time</th></tr>
            </thead>
            <tbody>
              {report.workload.map((t) => (
                <tr key={t.technician}>
                  <td className="cell-title">{t.technician}</td>
                  <td>{t.assigned}</td>
                  <td>{t.resolved}</td>
                  <td>{t.open}</td>
                  <td>{formatHours(t.avg_hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default function ReportsPage() {
  return (
    <Shell roles={["admin"]}>
      <Reports />
    </Shell>
  );
}
