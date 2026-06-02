"use client";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";

function SignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDev = process.env.NODE_ENV === "development";

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0f1022", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e8eaf8", margin: 0 }}>Diagrams</h1>
        <p style={{ fontSize: 14, color: "#5a5c7a", margin: 0 }}>Sign in to view your saved diagrams</p>
        {isDev ? (
          <a href="/" style={{ fontSize: 14, fontWeight: 600, color: "#a78bfa", textDecoration: "none" }}>Go in (dev) →</a>
        ) : (
          <button onClick={signInWithGoogle} disabled={loading} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            width: 280, padding: "11px 0", fontSize: 14, fontWeight: 600, borderRadius: 8,
            background: "#ffffff", color: "#1f2937", border: "1px solid #2a2b45",
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, transition: "opacity 0.2s",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? "Signing in…" : "Continue with Google"}
          </button>
        )}
        {error && <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>{error}</p>}
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
