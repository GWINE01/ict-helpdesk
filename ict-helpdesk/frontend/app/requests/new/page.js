"use client";

// Staff: submit a new request.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";

const PRIORITY_HELP = {
  Low: "Minor, I can work",
  Medium: "Slows my work",
  High: "I cannot work",
  Urgent: "Whole office affected",
};

function NewRequestForm() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    category_id: "",
    location: "",
    title: "",
    description: "",
    priority: "Medium",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/categories").then((list) => {
      setCategories(list);
      setForm((old) => ({ ...old, category_id: String(list[0]?.id ?? "") }));
    });
  }, []);

  function update(field, value) {
    setForm((old) => ({ ...old, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = { ...form, category_id: Number(form.category_id) };
      const created = await api("/requests", { method: "POST", body });
      router.push(`/requests/${created.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="page narrow">
      <div className="stack">
        <h1>Report an ICT problem</h1>
        <p className="lead">The ICT team receives this straight away. You do not need to visit the office.</p>
      </div>

      <div className="split">
        <form className="card column main" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <div className="row" style={{ gap: 20, alignItems: "flex-start" }}>
            <div className="field">
              <label htmlFor="category">Problem category</label>
              <select id="category" className="select" value={form.category_id}
                onChange={(e) => update("category_id", e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="location">Location</label>
              <input id="location" className="input" required minLength={2} maxLength={100}
                placeholder="Building and room" value={form.location}
                onChange={(e) => update("location", e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="title">Short title</label>
            <input id="title" className="input" required minLength={5} maxLength={150}
              placeholder="For example: Printer not printing" value={form.title}
              onChange={(e) => update("title", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="description">Describe the issue</label>
            <textarea id="description" className="textarea" rows={5} required minLength={10} maxLength={2000}
              value={form.description} onChange={(e) => update("description", e.target.value)} />
            <span className="hint">Include any error message and when it started.</span>
          </div>

          <fieldset>
            <legend className="legend">Priority</legend>
            <div className="priority-grid">
              {Object.keys(PRIORITY_HELP).map((level) => (
                <label key={level} className={`priority ${form.priority === level ? "selected" : ""}`}>
                  <input type="radio" name="priority" checked={form.priority === level}
                    onChange={() => update("priority", level)} />
                  <span>
                    <b>{level}</b>
                    <span>{PRIORITY_HELP[level]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="row">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Submitting..." : "Submit request"}
            </button>
          </div>
        </form>

        <aside className="side column" style={{ gap: 16 }}>
          <div className="card column" style={{ gap: 12, padding: 20 }}>
            <h2 style={{ fontSize: 16 }}>What happens next</h2>
            <ol className="muted" style={{ listStyle: "decimal", paddingLeft: 20, display: "grid", gap: 8, fontSize: 14 }}>
              <li>Your request is logged as Pending.</li>
              <li>ICT assigns a technician.</li>
              <li>The technician works on it and records the fix.</li>
              <li>You confirm it works and the request is closed.</li>
            </ol>
          </div>
          <div className="card column" style={{ gap: 12, padding: 20 }}>
            <h2 style={{ fontSize: 16 }}>Quick checks first</h2>
            <ul className="muted" style={{ listStyle: "disc", paddingLeft: 20, display: "grid", gap: 8, fontSize: 14 }}>
              <li>Is the device plugged in and switched on?</li>
              <li>Have you restarted it once?</li>
              <li>Is the network cable or Wi-Fi connected?</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function NewRequestPage() {
  return (
    <Shell roles={["staff"]}>
      <NewRequestForm />
    </Shell>
  );
}
