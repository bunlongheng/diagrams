"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/app/CuteToast";
import type { User } from "@supabase/supabase-js";

type Diagram = {
  id: string; title: string; slug: string;
  diagram_type: string; created_at: string; code: string;
};

// ── Favorites ─────────────────────────────────────────────────────────────────
const LS_FAVS = "mermaid:favorites";
function loadFavs(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_FAVS) ?? "[]")); } catch { return new Set(); }
}
function saveFavs(favs: Set<string>) { localStorage.setItem(LS_FAVS, JSON.stringify([...favs])); }

// ── Helpers ───────────────────────────────────────────────────────────────────
const PALETTE = ["#7c3aed","#2563eb","#16a34a","#ea580c","#ca8a04","#db2777","#dc2626","#0d9488","#0369a1","#7c2d12"];

const TYPE_COLORS: Record<string, string> = {
  sequence: "#7c3aed", flowchart: "#2563eb", class: "#16a34a",
  er: "#ea580c", gantt: "#ca8a04", mindmap: "#db2777", git: "#dc2626", pie: "#0d9488",
};
function typeColor(t: string) { return TYPE_COLORS[t] ?? "#64748b"; }

function relativeTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Diagram stats parser ──────────────────────────────────────────────────────
type Component = { name: string; color: string; count: number };

function parseComponents(code: string, type: string): Component[] {
  const lines = code.split("\n").map(l => l.trim()).filter(Boolean);

  if (type === "sequence") {
    const seen = new Map<string, number>();
    // Collect declared participants/actors
    for (const line of lines) {
      const m = line.match(/^(?:participant|actor)\s+(.+?)(?:\s+as\s+.+)?$/i);
      if (m) { const n = m[1].trim(); if (!seen.has(n)) seen.set(n, 0); }
    }
    // If none declared, collect from arrows
    if (seen.size === 0) {
      for (const line of lines) {
        const m = line.match(/^(\w[\w ]*?)\s*(?:->|-->>|->|-->|-)[-x>]+\s*(\w[\w ]*?)\s*:/);
        if (m) { [m[1].trim(), m[2].trim()].forEach(n => { if (!seen.has(n)) seen.set(n, 0); }); }
      }
    }
    // Count appearances
    for (const [name] of seen) {
      const cnt = lines.filter(l => l.includes(name)).length;
      seen.set(name, cnt);
    }
    return [...seen.entries()].slice(0, 6).map(([name, count], i) => ({ name, color: PALETTE[i % PALETTE.length], count }));
  }

  if (type === "flowchart") {
    const nodes = new Map<string, string>();
    for (const line of lines) {
      for (const m of [...line.matchAll(/\b([A-Za-z0-9_]+)\s*[\[\(\{<]([^\]\)\}>]{1,30})[\]\)\}>]/g)]) {
        if (!["graph","flowchart","subgraph"].includes(m[1].toLowerCase())) nodes.set(m[1], m[2].replace(/["']/g, ""));
      }
    }
    return [...nodes.entries()].slice(0, 6).map(([id, label], i) => ({
      name: label || id,
      color: PALETTE[i % PALETTE.length],
      count: lines.filter(l => new RegExp(`\\b${id}\\b`).test(l)).length,
    }));
  }

  if (type === "class") {
    const classes: string[] = [];
    for (const line of lines) {
      const m = line.match(/^class\s+(\w+)/);
      if (m && !classes.includes(m[1])) classes.push(m[1]);
    }
    return classes.slice(0, 6).map((name, i) => ({
      name, color: PALETTE[i % PALETTE.length],
      count: lines.filter(l => l.includes(name)).length,
    }));
  }

  if (type === "er") {
    const entities: string[] = [];
    for (const line of lines) {
      const m = line.match(/^([A-Z][A-Z0-9_]+)\s*\{/);
      if (m && !entities.includes(m[1])) entities.push(m[1]);
    }
    return entities.slice(0, 6).map((name, i) => ({
      name, color: PALETTE[i % PALETTE.length],
      count: lines.filter(l => l.includes(name)).length,
    }));
  }

  if (type === "pie") {
    const slices: { name: string; count: number }[] = [];
    for (const line of lines) {
      const m = line.match(/^\s*"([^"]+)"\s*:\s*([\d.]+)/);
      if (m) slices.push({ name: m[1], count: Math.round(parseFloat(m[2])) });
    }
    return slices.slice(0, 6).map(({ name, count }, i) => ({ name, color: PALETTE[i % PALETTE.length], count }));
  }

  if (type === "gantt") {
    const sections: string[] = [];
    for (const line of lines) {
      const m = line.match(/^section\s+(.+)/i);
      if (m) sections.push(m[1].trim());
    }
    const tasks = lines.filter(l => !l.match(/^(gantt|title|dateFormat|section|axisFormat)/i) && l.includes(":")).length;
    return sections.slice(0, 4).map((name, i) => ({ name, color: PALETTE[i % PALETTE.length], count: tasks }));
  }

  return [];
}

// ── Stats view (replaces tiny SVG) ───────────────────────────────────────────
function DiagramStats({ code, type }: { code: string; type: string }) {
  const components = parseComponents(code, type);
  const total = components.length;
  const MAX_ROWS = 3;
  const overflow = total - MAX_ROWS;

  if (total === 0) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 0 }}>
          {PALETTE.slice(0, 5).map((c, i) => (
            <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: "2px solid #fff", marginLeft: i ? -5 : 0, opacity: 0.3 }} />
          ))}
        </div>
        <span style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 500 }}>No preview</span>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 5, boxSizing: "border-box" }}>
      {/* Rows */}
      {components.slice(0, MAX_ROWS).map((c, idx) => {
        const isLast = idx === Math.min(MAX_ROWS, total) - 1;
        return (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#334155", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.name}
            </span>
            {isLast && overflow > 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", flexShrink: 0 }}>+{overflow}</span>
            )}
            <span style={{ fontSize: 10, fontWeight: 700, color: c.color, background: c.color + "18", borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>
              {c.count}
            </span>
          </div>
        );
      })}

      {/* Dot row + total */}
      <div style={{ display: "flex", alignItems: "center", marginTop: "auto" }}>
        <div style={{ display: "flex", flex: 1 }}>
          {components.map((c, i) => (
            <div key={i} title={c.name} style={{
              width: 16, height: 16, borderRadius: "50%", background: c.color,
              marginLeft: i ? -5 : 0, border: "2px solid #fff",
              flexShrink: 0, zIndex: components.length - i, position: "relative",
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            }} />
          ))}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#1e293b", background: "#1e293b18", borderRadius: 20, padding: "2px 7px", flexShrink: 0, marginLeft: 6 }}>
          {total}
        </span>
      </div>
    </div>
  );
}

// ── Rename modal ──────────────────────────────────────────────────────────────
function RenameModal({ title, onSave, onClose }: { title: string; onSave: (t: string) => void; onClose: () => void }) {
  const [val, setVal] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(2px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 16px" }}>Rename Diagram</h3>
        <input
          ref={inputRef}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && val.trim()) onSave(val.trim()); if (e.key === "Escape") onClose(); }}
          placeholder="Diagram title…"
          style={{ width: "100%", padding: "10px 14px", fontSize: 14, border: "1.5px solid #7c3aed", borderRadius: 10, outline: "none", fontFamily: "inherit", marginBottom: 16, boxSizing: "border-box", color: "#1e293b" }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #e2e8f0", borderRadius: 9, background: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "#64748b" }}>Cancel</button>
          <button onClick={() => val.trim() && onSave(val.trim())} style={{ padding: "8px 20px", background: "linear-gradient(135deg,#7c3aed,#a78bfa)", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function DiagramCard({ d, isFav, onOpen, onToggleFav, onDelete, onShare, onRename, copied, deleting }: {
  d: Diagram; isFav: boolean;
  onOpen: () => void; onToggleFav: () => void; onDelete: () => void; onShare: () => void; onRename: () => void;
  copied: boolean; deleting: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const color = typeColor(d.diagram_type);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onOpen}
      style={{
        background: "#fff",
        border: `2px solid ${hovered ? "#7c3aed" : "#e8edf5"}`,
        borderRadius: 16, overflow: "hidden", cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
        boxShadow: hovered ? "0 8px 24px rgba(124,58,237,0.12)" : "0 1px 4px rgba(0,0,0,0.05)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      {/* Header */}
      <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid #eef2f8", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {d.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>
          <svg width={11} height={11} viewBox="0 0 20 20" fill="none">
            <circle cx={10} cy={10} r={7} stroke="currentColor" strokeWidth={1.8} />
            <path d="M10 7v3.5l2 2" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
          </svg>
          {relativeTime(d.created_at)}
        </div>
      </div>

      {/* Stats thumbnail */}
      <div style={{ height: 110, background: "linear-gradient(145deg,#f8faff,#f1f5ff)", position: "relative" }}>
        <DiagramStats code={d.code} type={d.diagram_type} />

        {hovered && (
          <>
            {/* Star */}
            <button onClick={e => { e.stopPropagation(); onToggleFav(); }} title={isFav ? "Unfavorite" : "Favorite"}
              style={{ position: "absolute", top: 8, left: 8, width: 28, height: 28, borderRadius: 8, border: isFav ? "1px solid #fde68a" : "1px solid #e2e8f0", background: "rgba(255,255,255,0.95)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill={isFav ? "#eab308" : "none"} stroke={isFav ? "#eab308" : "#94a3b8"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
            {/* Rename */}
            <button onClick={e => { e.stopPropagation(); onRename(); }} title="Rename"
              style={{ position: "absolute", top: 8, left: 44, width: 28, height: 28, borderRadius: 8, border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.95)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} strokeLinecap="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            {/* Share */}
            <button onClick={e => { e.stopPropagation(); onShare(); }} title="Copy share link"
              style={{ position: "absolute", top: 8, right: 40, width: 28, height: 28, borderRadius: 8, border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.95)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", color: copied ? "#16a34a" : "#64748b" }}>
              {copied ? <span style={{ fontSize: 11, fontWeight: 700 }}>✓</span> : (
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1={12} y1={2} x2={12} y2={15}/>
                </svg>
              )}
            </button>
            {/* Delete */}
            <button onClick={e => { e.stopPropagation(); onDelete(); }} title="Delete" disabled={deleting}
              style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 8, border: "1px solid #fecaca", background: "rgba(255,255,255,0.95)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </>
        )}

        {/* Type badge */}
        <span style={{ position: "absolute", bottom: 8, left: 8, fontSize: 9, fontWeight: 700, color, background: `${color}18`, borderRadius: 20, padding: "2px 7px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {d.diagram_type}
        </span>
      </div>
    </div>
  );
}

// ── Avatar cache ──────────────────────────────────────────────────────────────
const LS_KEY = "mermaid_user_cache";
function cacheAvatar(url: string): Promise<string> {
  return new Promise(resolve => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas"); c.width = 56; c.height = 56;
        c.getContext("2d")!.drawImage(img, 0, 0, 56, 56); resolve(c.toDataURL("image/jpeg", 0.8));
      } catch { resolve(url); }
    };
    img.onerror = () => resolve(url);
    img.src = url.replace(/=s\d+-c$/, "=s56-c");
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function GalleryClient({ user, diagrams: initial, onRefresh }: { user: User; diagrams: Diagram[]; onRefresh?: () => void }) {
  const [diagrams, setDiagrams] = useState(initial);
  useEffect(() => { setDiagrams(initial); }, [initial]);

  const [favs, setFavs] = useState<Set<string>>(loadFavs);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [renamingDiagram, setRenamingDiagram] = useState<Diagram | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "";

  useEffect(() => {
    const liveUrl = user.user_metadata?.avatar_url ?? user.user_metadata?.picture;
    if (liveUrl) setAvatarSrc(liveUrl);
  }, [user]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Global paste on gallery page — save new record + open in editor ──────
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const pasted = e.clipboardData?.getData("text") ?? "";
      if (!pasted.trim()) return;
      const looksLikeMermaid = /^(sequenceDiagram|flowchart|graph\s|classDiagram|erDiagram|gantt|pie|mindmap|gitGraph|journey)/im.test(pasted.trim());
      if (!looksLikeMermaid) return;
      e.preventDefault();

      // Extract title + type from pasted code
      const titleMatch = pasted.match(/^\s*(?:title|accTitle):?\s+(.+)$/im);
      const title = titleMatch ? titleMatch[1].trim() : "Untitled";
      const typeMatch = pasted.trim().match(/^(sequenceDiagram|flowchart|graph|classDiagram|erDiagram|gantt|pie|mindmap|gitGraph|journey)/i);
      const dtype = typeMatch ? typeMatch[1].toLowerCase().replace("graph", "flowchart") : "mermaid";

      // Save new record then open in editor
      let savedId: string | null = null;
      try {
        const supabase = createClient();
        const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
        let slug = base; let n = 2; let finalTitle = title;
        while (true) {
          const { data } = await supabase.from("diagrams").select("id").eq("slug", slug).limit(1);
          if (!data || data.length === 0) break;
          slug = `${base}-${n}`; finalTitle = `${title} ${n}`; n++;
        }
        const { data: inserted } = await supabase.from("diagrams").insert({ user_id: user.id, title: finalTitle, slug, code: pasted, diagram_type: dtype }).select("id").single();
        savedId = inserted?.id ?? null;
      } catch { /* navigate anyway */ }

      window.location.href = savedId ? `/?id=${savedId}` : `/`;
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [user]);

  async function saveTitle(id: string, newTitle: string) {
    const supabase = createClient();
    await supabase.from("diagrams").update({ title: newTitle }).eq("id", id);
    setDiagrams(prev => prev.map(d => d.id === id ? { ...d, title: newTitle } : d));
    setRenamingDiagram(null);
  }

  function toggleFav(id: string) {
    setFavs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveFavs(next); return next;
    });
  }

  function signOut() {
    createClient().auth.signOut().then(() => { localStorage.removeItem(LS_KEY); window.location.reload(); });
  }

  function openInEditor(d: Diagram) {
    window.location.href = `/?id=${d.id}`;
  }

  function copyShareLink(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/d/${id}`).then(() => {
      setCopied(id); setTimeout(() => setCopied(null), 1500);
    });
  }

  async function deleteDiagram(id: string) {
    if (!confirm("Delete this diagram?")) return;
    setDeleting(id);
    const supabase = createClient();
    const { error } = await supabase.from("diagrams").delete().eq("id", id);
    if (error) {
      showToast(`Delete failed: ${error.message}`, { color: "#ef4444" });
      setDeleting(null); return;
    }
    showToast("Deleted ✓", { color: "#64748b" });
    setDiagrams(prev => prev.filter(d => d.id !== id));
    setFavs(prev => { const next = new Set(prev); next.delete(id); saveFavs(next); return next; });
    setDeleting(null);
  }

  const filtered = search.trim()
    ? diagrams.filter(d => d.title.toLowerCase().includes(search.toLowerCase()) || d.diagram_type.toLowerCase().includes(search.toLowerCase()))
    : diagrams;

  const favDiagrams = filtered.filter(d => favs.has(d.id));
  const recentDiagrams = filtered.filter(d => !favs.has(d.id));

  const cardProps = (d: Diagram) => ({
    d, isFav: favs.has(d.id),
    onOpen: () => openInEditor(d),
    onToggleFav: () => toggleFav(d.id),
    onDelete: () => deleteDiagram(d.id),
    onShare: () => copyShareLink(d.id),
    onRename: () => setRenamingDiagram(d),
    copied: copied === d.id,
    deleting: deleting === d.id,
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <header style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#7c3aed,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(124,58,237,0.3)", fontSize: 16 }}>🧜</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Mermaid++</span>
        </div>
        <div style={{ position: "relative", width: 220 }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} width={14} height={14} viewBox="0 0 20 20" fill="none">
            <circle cx={9} cy={9} r={6} stroke="currentColor" strokeWidth={1.8} />
            <path d="M14 14l3 3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search diagrams…"
            style={{ width: "100%", padding: "7px 12px 7px 32px", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 13, outline: "none", fontFamily: "inherit", color: "#334155", background: "#f8fafc" }} />
        </div>
        <div style={{ flex: 1 }} />
        <div ref={menuRef} style={{ position: "relative" }}>
          <button onClick={() => setShowMenu(v => !v)}
            style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", border: showMenu ? "2px solid #7c3aed" : "2px solid #e2e8f0", cursor: "pointer", padding: 0, background: "#e0e7ff", transition: "border-color 0.15s", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed", userSelect: "none" }}>{name[0]?.toUpperCase()}</span>
            {avatarSrc && <img src={avatarSrc} alt="" referrerPolicy="no-referrer" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
          </button>
          {showMenu && (
            <div style={{ position: "absolute", top: 42, right: 0, width: 200, background: "#fff", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", border: "1px solid #f1f5f9", overflow: "hidden", zIndex: 50 }}>
              <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{user.email}</div>
              </div>
              <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", fontSize: 13, color: "#334155", textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>✏️ Open Editor</a>
              <button onClick={signOut}
                style={{ width: "100%", padding: "10px 14px", textAlign: "left", background: "none", border: "none", borderTop: "1px solid #f1f5f9", cursor: "pointer", fontSize: 13, color: "#ef4444", fontFamily: "inherit", fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#fef2f2")} onMouseLeave={e => (e.currentTarget.style.background = "none")}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{ padding: "32px 24px" }}>

        {filtered.length === 0 && (
          <div style={{ position: "fixed", inset: 0, top: 56, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ fontSize: 40, opacity: 0.3, marginBottom: 12 }}>🧜</div>
            <p style={{ fontSize: 15, color: "#94a3b8", fontWeight: 600, margin: 0 }}>{search ? "No diagrams found" : "No diagrams yet"}</p>
            <p style={{ fontSize: 13, color: "#cbd5e1", marginTop: 6 }}>{search ? "Try a different search" : "Paste Mermaid code to get started"}</p>
          </div>
        )}

        {/* Favorites — horizontal scroll */}
        {favDiagrams.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Favorites · {favDiagrams.length}
            </h2>
            <div style={{ display: "flex", gap: 16, overflowX: "auto", overflowY: "visible", paddingBottom: 12, paddingTop: 4, scrollbarWidth: "none" }}>
              {favDiagrams.map(d => (
                <div key={d.id} style={{ flexShrink: 0, width: 340 }}>
                  <DiagramCard {...cardProps(d)} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent — 3-column grid */}
        {recentDiagrams.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
              {favDiagrams.length > 0 ? "Recent" : "All Diagrams"} · {recentDiagrams.length}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {recentDiagrams.map(d => <DiagramCard key={d.id} {...cardProps(d)} />)}
            </div>
          </section>
        )}
      </main>

      {/* ── FAB ── */}
      <a href="/" title="New diagram"
        style={{ position: "fixed", bottom: 28, right: 28, width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(124,58,237,0.45)", textDecoration: "none", fontSize: 28, color: "#fff", animation: "fabPulse 2.5s ease-in-out infinite" }}
      >+</a>

      {/* ── Rename modal ── */}
      {renamingDiagram && (
        <RenameModal
          title={renamingDiagram.title}
          onSave={t => saveTitle(renamingDiagram.id, t)}
          onClose={() => setRenamingDiagram(null)}
        />
      )}

      <style>{`
        @keyframes fabPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(124,58,237,0.45); transform: scale(1); }
          50%       { box-shadow: 0 4px 32px rgba(124,58,237,0.7);  transform: scale(1.06); }
        }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
