"use client";

// Request detail: progress bar, details, technician's work and the activity timeline.
// Staff see their own requests here. Admins can open any request.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusPill } from "@/components/Pills";
import Shell, { useUser } from "@/components/Shell";
import { api } from "@/lib/api";
import { formatDate, requestCode, STATUSES } from "@/lib/format";

// One sentence for each row of the status history.
function describe(entry) {
  if (entry.old_status === null) return "submitted the request";
  if (entry.old_status === entry.new_status) return "reassigned the request";
  if (entry.new_status === "Assigned") return "assigned a technician";
  if (entry.new_status === "In Progress") return "started work";
  if (entry.new_status === "Resolved") return "marked it as resolved";
  return "closed the request";
}

function RequestDetail() {
  const { id } = useParams();
  const user = useUser();
  const [request, setRequest] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api(`/requests/${id}`).then(setRequest).catch((err) => setError(err.message));
  }

  useEffect(load, [id]);

  async function closeRequest() {
    setBusy(true);
    setError("");
    try {
      await api(`/requests/${id}/close`, { method: "POST" });
      load();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  if (error && !request) {
    return <main className="page narrow"><div className="alert alert-error" role="alert">{error}</div></main>;
  }
  if (!request) return <main className="page narrow"><p className="muted">Loading...</p></main>;

  const currentStep = STATUSES.indexOf(request.status);
  const backHref = user.role === "admin" ? "/dashboard" : "/requests";
  const backLabel = user.role === "admin" ? "Requests" : "My requests";
  const canClose = request.status === "Resolved";

  return (
    <main className="page narrow">
      <div className="row between">
        <div className="stack" style={{ gap: 8, minWidth: 0 }}>
          <div className="muted" style={{ fontSize: 14 }}>
            <Link href={backHref}>{backLabel}</Link> / <span className="code">{requestCode(request.id)}</span>
          </div>
          <h1>{request.title}</h1>
        </div>
        <StatusPill status={request.status} large />
      </div>

      <ol className="card steps">
        {STATUSES.map((status, index) => {
          const state = index < currentStep || request.status === "Closed" ? "done"
            : index === currentStep ? "current" : "";
          return (
            <li key={status} className={`step ${state}`}>
              <div className="bar" />
              <b>{status}</b>
            </li>
          );
        })}
      </ol>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="split">
        <section className="card column main">
          <h2>Request details</h2>
          <dl className="facts">
            <div><dt>Category</dt><dd>{request.category}</dd></div>
            <div><dt>Location</dt><dd>{request.location}</dd></div>
            <div><dt>Priority</dt><dd>{request.priority}</dd></div>
            <div><dt>Technician</dt><dd>{request.technician || "Not assigned yet"}</dd></div>
            <div><dt>Reported by</dt><dd>{request.requester}, {request.requester_department}</dd></div>
            <div><dt>Submitted</dt><dd>{formatDate(request.created_at)}</dd></div>
          </dl>
          <div className="stack">
            <div className="small muted">Description</div>
            <p className="quote">{request.description}</p>
          </div>

          {request.resolution?.resolved_at && (
            <div className="divider column" style={{ gap: 14 }}>
              <h2>What the technician did</h2>
              <div className="stack">
                <div className="small muted">Diagnosis</div>
                <p>{request.resolution.diagnosis}</p>
              </div>
              <div className="stack">
                <div className="small muted">Solution</div>
                <p>{request.resolution.solution}</p>
              </div>
            </div>
          )}

          {request.status !== "Closed" && (
            <div className="divider column" style={{ gap: 10 }}>
              <p className="muted" style={{ fontSize: 14 }}>
                {canClose
                  ? "The technician has marked this as resolved. Confirm that the fix works to close the request."
                  : "When the technician marks this as resolved, it can be confirmed and closed here."}
              </p>
              <div>
                <button className="btn btn-primary" disabled={!canClose || busy} onClick={closeRequest}>
                  {user.role === "admin" ? "Close request" : "Confirm fix and close"}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="card column side">
          <h2>Activity</h2>
          <ol className="timeline">
            {request.history.map((entry, index) => (
              <li key={index}>
                <div className="dot" />
                <div className="stack" style={{ gap: 3 }}>
                  <div><b>{entry.changed_by}</b> {describe(entry)}</div>
                  {entry.note && <div className="muted" style={{ fontSize: 14 }}>{entry.note}</div>}
                  <div className="small muted">{formatDate(entry.changed_at)}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}

export default function RequestDetailPage() {
  return (
    <Shell roles={["staff", "admin"]}>
      <RequestDetail />
    </Shell>
  );
}
