"use client";

// Technician: jobs assigned to me, and the form to record diagnosis and solution.

import { useEffect, useState } from "react";
import { StatusPill } from "@/components/Pills";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";
import { requestCode } from "@/lib/format";

function Jobs() {
  const [jobs, setJobs] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [job, setJob] = useState(null);
  const [work, setWork] = useState({ diagnosis: "", solution: "", note: "" });
  const [message, setMessage] = useState(null); // { type: "ok" | "error", text }

  async function loadJobs() {
    const list = await api("/requests");
    setJobs(list);
    return list;
  }

  async function loadJob(id) {
    const detail = await api(`/requests/${id}`);
    setJob(detail);
    setWork({
      diagnosis: detail.resolution?.diagnosis || "",
      solution: detail.resolution?.solution || "",
      note: "",
    });
  }

  // First load: fetch the list and open the first job that still needs work.
  useEffect(() => {
    loadJobs().then((list) => {
      const first = list.find((j) => j.status === "In Progress" || j.status === "Assigned") || list[0];
      if (first) setSelectedId(first.id);
    });
  }, []);

  useEffect(() => {
    if (selectedId) {
      setMessage(null);
      loadJob(selectedId);
    }
  }, [selectedId]);

  // Run one action against the backend, then refresh both panels.
  async function run(action, successText) {
    setMessage(null);
    try {
      await action();
      await loadJobs();
      await loadJob(selectedId);
      setMessage({ type: "ok", text: successText });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  }

  const startWork = () =>
    run(() => api(`/requests/${selectedId}/start`, { method: "POST", body: { note: work.note } }), "Work started.");

  const saveProgress = () =>
    run(() => api(`/requests/${selectedId}/work`, {
      method: "PUT",
      body: { diagnosis: work.diagnosis, solution: work.solution },
    }), "Progress saved.");

  const markResolved = (event) => {
    event.preventDefault();
    run(() => api(`/requests/${selectedId}/resolve`, { method: "POST", body: work }), "Marked as resolved.");
  };

  return (
    <main className="page">
      <div className="split">
        <aside className="side column" style={{ gap: 12 }}>
          <h2>My jobs</h2>
          {jobs === null && <p className="muted">Loading...</p>}
          {jobs?.length === 0 && <p className="muted">No jobs have been assigned to you yet.</p>}
          {jobs?.map((j) => (
            <button key={j.id} className={`job ${j.id === selectedId ? "selected" : ""}`} onClick={() => setSelectedId(j.id)}>
              <div className="job-head">
                <span className="code">{requestCode(j.id)}</span>
                <StatusPill status={j.status} />
              </div>
              <div className="cell-title">{j.title}</div>
              <div className="cell-sub">{j.location}, {j.priority} priority</div>
            </button>
          ))}
        </aside>

        {job && (
          <section className="main column">
            <div className="card column" style={{ gap: 16 }}>
              <div className="row between">
                <div className="stack" style={{ minWidth: 0 }}>
                  <div className="code muted">{requestCode(job.id)}</div>
                  <h1 style={{ fontSize: 24 }}>{job.title}</h1>
                </div>
                <StatusPill status={job.status} large />
              </div>
              <dl className="facts">
                <div><dt>Reported by</dt><dd>{job.requester}, {job.requester_department}</dd></div>
                <div><dt>Location</dt><dd>{job.location}</dd></div>
                <div><dt>Category</dt><dd>{job.category}</dd></div>
                <div><dt>Priority</dt><dd>{job.priority}</dd></div>
              </dl>
              <p className="quote">{job.description}</p>
            </div>

            {message && (
              <div className={`alert ${message.type === "ok" ? "alert-ok" : "alert-error"}`} role="status">
                {message.text}
              </div>
            )}

            {job.status === "Assigned" && (
              <div className="card column">
                <h2>Start this job</h2>
                <div className="field">
                  <label htmlFor="start-note">Note to staff (optional)</label>
                  <input id="start-note" className="input" maxLength={300}
                    placeholder="For example: On my way to your office"
                    value={work.note} onChange={(e) => setWork({ ...work, note: e.target.value })} />
                </div>
                <div><button className="btn btn-primary" onClick={startWork}>Start work</button></div>
              </div>
            )}

            {job.status === "In Progress" && (
              <form className="card column" onSubmit={markResolved}>
                <h2>Record your work</h2>
                <div className="field">
                  <label htmlFor="diagnosis">Diagnosis</label>
                  <textarea id="diagnosis" className="textarea" rows={3} required minLength={5}
                    placeholder="What you found" value={work.diagnosis}
                    onChange={(e) => setWork({ ...work, diagnosis: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="solution">Solution</label>
                  <textarea id="solution" className="textarea" rows={3} required minLength={5}
                    placeholder="What you did to fix it" value={work.solution}
                    onChange={(e) => setWork({ ...work, solution: e.target.value })} />
                  <span className="hint">Diagnosis and solution are both required before a job can be marked as resolved.</span>
                </div>
                <div className="field">
                  <label htmlFor="note">Note to staff (optional)</label>
                  <input id="note" className="input" maxLength={300}
                    placeholder="Shown on the requester's activity timeline"
                    value={work.note} onChange={(e) => setWork({ ...work, note: e.target.value })} />
                </div>
                <div className="row">
                  <button className="btn btn-primary">Mark as resolved</button>
                  <button type="button" className="btn btn-secondary" onClick={saveProgress}>Save progress</button>
                </div>
              </form>
            )}

            {(job.status === "Resolved" || job.status === "Closed") && job.resolution && (
              <div className="card column" style={{ gap: 14 }}>
                <h2>Work recorded</h2>
                <div className="stack"><div className="small muted">Diagnosis</div><p>{job.resolution.diagnosis}</p></div>
                <div className="stack"><div className="small muted">Solution</div><p>{job.resolution.solution}</p></div>
                {job.status === "Resolved" && <p className="hint">Waiting for the requester to confirm the fix.</p>}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

export default function JobsPage() {
  return (
    <Shell roles={["technician"]}>
      <Jobs />
    </Shell>
  );
}
