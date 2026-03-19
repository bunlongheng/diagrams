"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import GalleryClient from "./GalleryClient";
import SignInButton from "./SignInButton";
import { CuteToast } from "@/app/CuteToast";

type Diagram = {
  id: string; title: string; slug: string;
  diagram_type: string; created_at: string; code: string;
};

export default function GalleryShell() {
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);

  useEffect(() => {
    const supabase = createClient();

    // fetchDiagrams uses the SAME supabase instance so auth state is shared
    async function fetchDiagrams() {
      const { data, error } = await supabase
        .from("diagrams")
        .select("id, title, slug, diagram_type, created_at, code")
        .order("created_at", { ascending: false });
      console.log("[gallery] rows:", data?.length, "error:", error?.message);
      if (data) setDiagrams(data);
    }

    const allowed = process.env.NEXT_PUBLIC_ALLOWED_EMAIL;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      if (u && allowed && u.email !== allowed) {
        supabase.auth.signOut();
        setUser(null);
      } else {
        setUser(prev => (prev && typeof prev !== "string" && u && prev.id === u.id ? prev : u ?? null));
        // Only fetch on initial load or sign-in, not on token refresh
        if (u && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) fetchDiagrams();
        if (event === "SIGNED_OUT") setDiagrams([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Loading spinner
  if (user === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#f5f5f8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#f5f5f8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,-apple-system,sans-serif" }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg,#7c3aed,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🧜</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>Mermaid++ Gallery</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Sign in to view your saved diagrams</p>
          <SignInButton />
          <a href="/" style={{ fontSize: 13, color: "#9ca3af", textDecoration: "none", marginTop: 4 }}>← Back to editor</a>
        </div>
      </div>
    );
  }

  return (
    <>
      <GalleryClient user={user} diagrams={diagrams} onRefresh={() => {}} />
      <CuteToast />
    </>
  );
}
