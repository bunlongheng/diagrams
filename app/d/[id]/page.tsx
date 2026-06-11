import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import db from "@/lib/db";
import { parse, buildSvg, DEFAULT_OPTS, DEFAULT_LAYOUT } from "@/lib/svg-renderer";
import type { Opts, Layout } from "@/lib/svg-renderer";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = { code: string; settings: { opts?: Partial<Opts>; layout?: Partial<Layout> } | null; title: string | null; created_at: Date | null };

async function getDiagram(id: string): Promise<Row | null> {
  if (!UUID.test(id)) return null;
  const { rows } = await db.query("SELECT code, settings, title, created_at FROM diagrams WHERE id = $1", [id]);
  if (!rows.length || !rows[0].code?.trim()) return null;
  return rows[0] as Row;
}

function render(row: Row) {
  const opts: Opts = { ...DEFAULT_OPTS, ...(row.settings?.opts ?? {}) };
  const layout: Layout = { ...DEFAULT_LAYOUT, ...(row.settings?.layout ?? {}) };
  const diagram = parse(row.code);
  if (!diagram.title && row.title) diagram.title = row.title;
  return { svg: buildSvg(diagram, opts, layout, row.created_at ?? undefined), title: diagram.title || row.title || "Diagram" };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await getDiagram(id);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "diagrams-bheng.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;
  const title = row ? render(row).title : "Diagram not found";
  const description = row ? "View this diagram - copy the link, open it in the editor, or export it." : "This diagram does not exist.";
  return {
    metadataBase: new URL(base),
    title: `${title} · Diagrams`,
    description,
    openGraph: { title, description, type: "article", url: `${base}/d/${id}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function DiagramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getDiagram(id);
  if (!row) notFound();
  const { svg, title } = render(row);

  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "32px 20px", background: "linear-gradient(135deg,#0f0a1e 0%,#1d1140 55%,#2e0f6b 100%)" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ width: 22, height: 13, background: "#fb7185", borderRadius: 3 }} />
          <span style={{ width: 22, height: 13, background: "#a78bfa", borderRadius: 3 }} />
          <span style={{ width: 22, height: 13, background: "#34d399", borderRadius: 3 }} />
        </div>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1, color: "rgba(255,255,255,0.92)" }}>Diagrams</span>
      </header>

      <h1 style={{ margin: 0, color: "#fff", fontSize: 28, fontWeight: 800, letterSpacing: -0.5, textAlign: "center", maxWidth: 900 }}>{title}</h1>

      <div
        style={{ width: "100%", maxWidth: 1100, background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 24px 70px rgba(0,0,0,0.45)", overflow: "auto" }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <nav style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <a href={`/?id=${id}`} style={{ padding: "10px 20px", borderRadius: 999, background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.5)", color: "#d8b4fe", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>Open in editor</a>
        <a href={`/svg/${id}`} style={{ padding: "10px 20px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>Download SVG</a>
      </nav>
    </main>
  );
}
