"use client";

// Staff: list of my own requests.

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusPill } from "@/components/Pills";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";
import { formatDate, requestCode } from "@/lib/format";

function MyRequests() {
  const [requests, setRequests] = useState(null);

  useEffect(() => {
    api("/requests").then(setRequests);
  }, []);

  return (
    <main className="page narrow">
      <div className="row between">
        <div className="stack">
          <h1>My requests</h1>
          <p className="lead">Open a request to see who is working on it and what has been done.</p>
        </div>
        <Link href="/requests/new" className="btn btn-primary">New request</Link>
      </div>

      <section className="card">
        {requests === null && <p className="empty">Loading...</p>}
        {requests?.length === 0 && (
          <p className="empty">You have not reported any problem yet. Use New request to report one.</p>
        )}
        {requests?.length > 0 && (
          <div className="table-wrap">
            <table style={{ minWidth: 640 }}>
              <thead>
                <tr><th>ID</th><th>Request</th><th>Technician</th><th>Submitted</th><th>Status</th></tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="code"><Link href={`/requests/${r.id}`}>{requestCode(r.id)}</Link></td>
                    <td>
                      <div className="cell-title">{r.title}</div>
                      <div className="cell-sub">{r.category}, {r.location}</div>
                    </td>
                    <td>{r.technician || <span className="muted">Not assigned yet</span>}</td>
                    <td className="muted">{formatDate(r.created_at)}</td>
                    <td><StatusPill status={r.status} /></td>
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

export default function MyRequestsPage() {
  return (
    <Shell roles={["staff"]}>
      <MyRequests />
    </Shell>
  );
}
