"use client";

// Login page.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getUser, homeFor, saveLogin } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Already signed in? Skip the form.
  useEffect(() => {
    const user = getUser();
    if (user) router.replace(homeFor(user.role));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api("/login", { method: "POST", body: { email, password } });
      saveLogin(data.token, data.user);
      router.replace(homeFor(data.user.role));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <section className="login-intro">
        <div className="brand">
          <div className="brand-mark">IT</div>
          ICT Help Desk
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <h1>Report an ICT problem without leaving your desk.</h1>
          <p className="soft" style={{ fontSize: 17 }}>ICT Department</p>
        </div>
        <ol className="login-steps">
          <li>
            <div className="num">1</div>
            <div>
              <b>Submit</b>
              <span className="soft">Describe the issue, its location and how urgent it is.</span>
            </div>
          </li>
          <li>
            <div className="num">2</div>
            <div>
              <b>Track</b>
              <span className="soft">See who is assigned and every status change.</span>
            </div>
          </li>
          <li>
            <div className="num">3</div>
            <div>
              <b>Confirm</b>
              <span className="soft">Close the request once the fix works for you.</span>
            </div>
          </li>
        </ol>
      </section>

      <section className="login-form-side">
        <form className="card column login-card" onSubmit={handleSubmit}>
          <div className="stack">
            <h2>Sign in</h2>
            <p className="muted">Use your staff account.</p>
          </div>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="email">Staff email</label>
            <input id="email" className="input" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" className="input" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
          <p className="hint">
            Forgot your password? Contact the ICT office. Accounts are created by the ICT administrator.
          </p>
        </form>
      </section>
    </div>
  );
}
