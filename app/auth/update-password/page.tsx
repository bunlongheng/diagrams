"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", fontSize: 14, borderRadius: 8,
    border: "1px solid #2a2b45", background: "#0f1022", color: "#e8eaf8",
    outline: "none", boxSizing: "border-box",
    fontFamily: "system-ui,-apple-system,sans-serif",
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError(""); setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setError(error.message);
    else setDone(true);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f1022", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: 280 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e8eaf8", margin: 0 }}>Set New Password</h1>
        {done ? (
          <>
            <p style={{ fontSize: 14, color: "#6ee7b7", margin: 0, textAlign: "center" }}>Password updated! Redirecting…</p>
            <script dangerouslySetInnerHTML={{ __html: `setTimeout(()=>location.replace('/'),1500)` }} />
          </>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <input
              type="password" placeholder="New password" value={password} required minLength={8}
              onChange={e => setPassword(e.target.value)} style={inputStyle}
            />
            <input
              type="password" placeholder="Confirm password" value={confirm} required
              onChange={e => setConfirm(e.target.value)} style={inputStyle}
            />
            {error && <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{
              padding: "10px 0", fontSize: 14, fontWeight: 600, borderRadius: 8,
              background: "#7c3aed", color: "white", border: "none",
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
            }}>
              {loading ? "Saving…" : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
