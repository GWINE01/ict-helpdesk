"use client";

// ICT admin: list accounts and create new ones.

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";

const EMPTY = { full_name: "", email: "", department: "", role: "staff", password: "" };
const ROLE_LABELS = { staff: "Staff", technician: "Technician", admin: "Admin" };

function Users() {
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState(null);

  function load() {
    api("/users").then(setUsers);
  }

  useEffect(load, []);

  function update(field, value) {
    setForm((old) => ({ ...old, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);
    try {
      await api("/users", { method: "POST", body: form });
      setMessage({ type: "ok", text: `Account created for ${form.full_name}.` });
      setForm(EMPTY);
      load();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  }

  return (
    <main className="page">
      <h1>Users</h1>
      <div className="split">
        <section className="card main">
          {users === null ? <p className="empty">Loading...</p> : (
            <div className="table-wrap">
              <table style={{ minWidth: 560 }}>
                <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="cell-title">{u.full_name}</td>
                      <td>{u.email}</td>
                      <td>{u.department}</td>
                      <td>{ROLE_LABELS[u.role]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <form className="card column side" onSubmit={handleSubmit}>
          <h2>Create an account</h2>
          {message && (
            <div className={`alert ${message.type === "ok" ? "alert-ok" : "alert-error"}`} role="status">{message.text}</div>
          )}
          <div className="field">
            <label htmlFor="full_name">Full name</label>
            <input id="full_name" className="input" required minLength={3} value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" required value={form.email}
              onChange={(e) => update("email", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="department">Department</label>
            <input id="department" className="input" required minLength={2} value={form.department}
              onChange={(e) => update("department", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" className="select" value={form.role} onChange={(e) => update("role", e.target.value)}>
              <option value="staff">Staff</option>
              <option value="technician">Technician</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="password">Temporary password</label>
            <input id="password" className="input" type="text" required minLength={8} value={form.password}
              onChange={(e) => update("password", e.target.value)} />
            <span className="hint">At least 8 characters.</span>
          </div>
          <div><button className="btn btn-primary">Create account</button></div>
        </form>
      </div>
    </main>
  );
}

export default function UsersPage() {
  return (
    <Shell roles={["admin"]}>
      <Users />
    </Shell>
  );
}
