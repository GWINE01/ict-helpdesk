"use client";

// ICT admin: see every request, filter them and assign technicians.

import Link from "next/link";
import { useEffect, useState } from "react";
import { PriorityPill, StatusPill } from "@/components/Pills";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";
import { formatDate, PRIORITIES, requestCode, STATUSES } from "@/lib/format";

function Dashboard() {
  const [requests, setRequests] = useState(null);
  const [categories, setCategories] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [filters, setFilters] = useState({ q: "", status: "open", priority: "", category_id: "" });
  const [assigning, setAssigning] = useState(null); // { requestId, technicianId }
  const [error, setError] = useState("");

  function load() {
    // Build "?status=open&priority=High" from the filters that are set.
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    api("/requests?" + query.toString()).then(setRequests);
  }

  useEffect(() => {
    api("/categories").then(setCategories);
    api("/technicians").then(setTechnicians);
  }, []);

  useEffect(load, [filters]);

  function setFilter(field, value) {
    setFilters((old) => ({ ...old, [field]: value }));
  }

  async function confirmAssign() {
    setError("");
    try {
      await api(`/requests/${assigning.requestId}/assign`, {
        method: "POST",
        body: { technician_id: Number(assigning.technicianId) },
      });
      setAssigning(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const count = (status) => (requests || []).filter((r) => r.status === status).length;

  return (
    <main className="page">
      <h1>Service requests</h1>

      <div className="grid-auto">
        <div className="tile"><div className="tile-label">Pending, not assigned</div><div className="tile-value">{count("Pending")}</div></div>
        <div className="tile"><div className="tile-label">Assigned</div><div className="tile-value">{count("Assigned")}</div></div>
        <div className="tile"><div className="tile-label">In progress</div><div className="tile-value">{count("In Progress")}</div></div>
        <div className="tile"><div className="tile-label">Resolved, awaiting staff</div><div className="tile-value">{count("Resolved")}</div></div>
      </div>

      <section className="card column" style={{ gap: 16 }}>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ flexGrow: 2 }}>
            <label htmlFor="search">Search</label>
            <input id="search" className="input" type="search" placeholder="ID, title or requester"
              value={filters.q} onChange={(e) => setFilter("q", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" className="select" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
              <option value="open">All open</option>
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="priority">Priority</label>
            <select id="priority" className="select" value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)}>
              <option value="">Any</option>
              {[...PRIORITIES].reverse().map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" className="select" value={filters.category_id} onChange={(e) => setFilter("category_id", e.target.value)}>
              <option value="">Any</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {requests === null && <p className="empty">Loading...</p>}
        {requests?.length === 0 && <p className="empty">No requests match these filters.</p>}

        {requests?.length > 0 && (
          <div className="table-wrap">
            <table style={{ minWidth: 980 }}>
              <thead>
                <tr><th>ID</th><th>Request</th><th>Requester</th><th>Priority</th><th>Status</th><th>Technician</th><th>Submitted</th></tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="code"><Link href={`/requests/${r.id}`}>{requestCode(r.id)}</Link></td>
                    <td>
                      <div className="cell-title">{r.title}</div>
                      <div className="cell-sub">{r.category}, {r.location}</div>
                    </td>
                    <td>{r.requester}</td>
                    <td><PriorityPill priority={r.priority} /></td>
                    <td><StatusPill status={r.status} /></td>
                    <td>
                      {assigning?.requestId === r.id ? (
                        <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                          <select className="select" aria-label="Technician" style={{ minWidth: 150 }}
                            value={assigning.technicianId}
                            onChange={(e) => setAssigning({ ...assigning, technicianId: e.target.value })}>
                            {technicians.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                          </select>
                          <button className="btn btn-primary btn-small" onClick={confirmAssign}>Save</button>
                          <button className="btn btn-secondary btn-small" onClick={() => setAssigning(null)}>Cancel</button>
                        </div>
                      ) : r.status === "Pending" ? (
                        <button className="btn btn-primary btn-small" disabled={technicians.length === 0}
                          onClick={() => setAssigning({ requestId: r.id, technicianId: String(technicians[0].id) })}>
                          Assign
                        </button>
                      ) : (
                        <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                          {r.technician}
                          {r.status === "Assigned" && (
                            <button className="link-button"
                              onClick={() => setAssigning({ requestId: r.id, technicianId: String(r.technician_id) })}>
                              Change
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="muted">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Shell roles={["admin"]}>
      <Dashboard />
    </Shell>
  );
}
