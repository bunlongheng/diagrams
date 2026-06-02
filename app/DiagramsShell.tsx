"use client";
import { useEffect, useState } from "react";
import { getSession } from "next-auth/react";
import DiagramsClient, { type ShellUser } from "./DiagramsClient";
import LoginForm from "./SignInButton";

type Diagram = {
  id: string; title: string; slug: string;
  diagram_type: string; created_at: string; updated_at: string; code: string; tags: string[];
};

export default function DiagramsShell() {
  const [user, setUser] = useState<ShellUser | null>(null);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [ready, setReady] = useState(false); // true only after auth + diagrams resolved

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // The /api/diagrams gate is the source of truth for authorization:
        // 200 on a real owner session OR a local/LAN request (Stickies-style
        // bypass); 401 otherwise. Avoids relying on getSession() alone, which
        // is null on localhost where there is no real session.
        const res = await fetch("/api/diagrams");
        if (!res.ok) { if (!cancelled) { setUser(null); setReady(true); } return; }

        const data = await res.json();
        const session = await getSession().catch(() => null);
        if (cancelled) return;

        if (Array.isArray(data)) setDiagrams(data);
        setUser({
          email: session?.user?.email ?? "owner",
          user_metadata: {
            full_name: session?.user?.name ?? undefined,
            avatar_url: session?.user?.image ?? undefined,
          },
        });
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Show loading until auth is checked AND diagrams are fetched
  if (!ready) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#f4f5f7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: 13, color: "#94a3b8", fontFamily: "system-ui" }}>Loading diagrams…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div style={{ position: "fixed", inset: 0, background: "#0f1022", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,-apple-system,sans-serif" }}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <svg width={64} height={64} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 16 }}>
              <defs><linearGradient id="sbg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0f051e"/><stop offset="55%" stopColor="#2e0f6b"/><stop offset="100%" stopColor="#0c2340"/></linearGradient></defs>
              <rect width="512" height="512" rx="115" fill="url(#sbg)"/>
              <rect x="48"  y="80" width="130" height="72" rx="16" fill="#fb7185"/>
              <rect x="191" y="80" width="130" height="72" rx="16" fill="#a78bfa"/>
              <rect x="334" y="80" width="130" height="72" rx="16" fill="#34d399"/>
              <line x1="113" y1="152" x2="113" y2="432" stroke="#fb7185" strokeWidth="4" strokeDasharray="20 12" opacity={0.3}/>
              <line x1="256" y1="152" x2="256" y2="432" stroke="#a78bfa" strokeWidth="4" strokeDasharray="20 12" opacity={0.3}/>
              <line x1="399" y1="152" x2="399" y2="432" stroke="#34d399" strokeWidth="4" strokeDasharray="20 12" opacity={0.3}/>
              <line x1="125" y1="210" x2="242" y2="210" stroke="#fbbf24" strokeWidth="14" strokeLinecap="round"/>
              <polygon points="268,210 240,196 240,224" fill="#fbbf24"/>
              <line x1="268" y1="290" x2="385" y2="290" stroke="#38bdf8" strokeWidth="14" strokeLinecap="round"/>
              <polygon points="411,290 383,276 383,304" fill="#38bdf8"/>
              <line x1="125" y1="370" x2="385" y2="370" stroke="#a78bfa" strokeWidth="14" strokeLinecap="round" strokeDasharray="28 14"/>
              <polygon points="99,370 127,356 127,384" fill="#a78bfa"/>
            </svg>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e8eaf8", margin: 0 }}>Diagrams</h1>
            <p style={{ fontSize: 14, color: "#5a5c7a", margin: 0 }}>Sign in to view your saved diagrams</p>
            <LoginForm />
          </div>
        </div>
      </>
    );
  }

  return <DiagramsClient user={user} diagrams={diagrams} />;
}
