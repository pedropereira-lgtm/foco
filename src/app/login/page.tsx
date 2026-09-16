"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
    setBusy(false);
    if (r.ok) location.href = "/";
    else setErr((await r.json().catch(() => ({}))).error || "Não consegui entrar.");
  }

  return (
    <>
      <div className="wall" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="login">
        <form className="glass login-card" onSubmit={submit}>
          <div className="brand"><span className="mark" />Foco</div>
          <h1>Bem-vindo de volta.</h1>
          <label className="lbl" htmlFor="pw">Password
            <input id="pw" className="field" type="password" autoFocus autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          {err && <p className="err">{err}</p>}
          <button className="btn primary" type="submit" disabled={busy} style={{ justifyContent: "center" }}>{busy ? "A entrar…" : "Entrar"}</button>
        </form>
      </div>
    </>
  );
}
