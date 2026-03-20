"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import DiagramsClient from "./DiagramsClient";
import SignInButton from "./SignInButton";
import { CuteToast } from "@/app/CuteToast";

type Diagram = {
  id: string; title: string; slug: string;
  diagram_type: string; created_at: string; code: string;
};

const DEV_USER = { id: "dev-local", email: "dev@localhost", user_metadata: { full_name: "Dev" } } as unknown as User;
const IS_DEV = process.env.NEXT_PUBLIC_LOCAL_DEV === "true";

export default function DiagramsShell() {
  const [user, setUser] = useState<User | null | "loading">(IS_DEV ? DEV_USER : "loading");
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);

  useEffect(() => {
    const supabase = createClient();

    async function fetchDiagrams() {
      if (IS_DEV) {
        const res = await fetch("/api/diagrams");
        const body = await res.json();
        setDiagrams(Array.isArray(body) ? body : []);
        return;
      }
      const { data } = await supabase
        .from("diagrams")
        .select("id, title, slug, diagram_type, created_at, code")
        .order("created_at", { ascending: false });
      if (data) setDiagrams(data);
    }

    if (IS_DEV) { fetchDiagrams(); return; }

    const allowed = process.env.NEXT_PUBLIC_ALLOWED_EMAIL;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      if (u && allowed && u.email !== allowed) {
        supabase.auth.signOut();
        setUser(null);
      } else {
        setUser(prev => (prev && typeof prev !== "string" && u && prev.id === u.id ? prev : u ?? null));
        if (u && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) fetchDiagrams();
        if (event === "SIGNED_OUT") setDiagrams([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Loading spinner (never on dev)
  if (!IS_DEV && user === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#0f1022", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not signed in (never on dev)
  if (!IS_DEV && !user) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f1022", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,-apple-system,sans-serif" }}>
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
          <SignInButton />
          <a href="/?new" style={{ fontSize: 13, color: "#9ca3af", textDecoration: "none", marginTop: 4 }}>← Open editor</a>
        </div>
      </div>
    );
  }

  return (
    <>
      <DiagramsClient user={user} diagrams={diagrams} onRefresh={() => {}} />
      <CuteToast />
    </>
  );
}
