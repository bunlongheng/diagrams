import { NextResponse } from "next/server";
import db from "@/lib/db";
import { parse, buildSvg, DEFAULT_OPTS, DEFAULT_LAYOUT } from "@/lib/svg-renderer";
import type { Opts, Layout } from "@/lib/svg-renderer";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const { rows } = await db.query("SELECT code, settings, title, created_at FROM diagrams WHERE id = $1", [id]);
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { code, settings, title, created_at } = rows[0];
  if (!code?.trim()) return NextResponse.json({ error: "No code" }, { status: 400 });

  const opts: Opts = { ...DEFAULT_OPTS, ...(settings?.opts ?? {}) };
  const layout: Layout = { ...DEFAULT_LAYOUT, ...(settings?.layout ?? {}) };

  const diagram = parse(code);
  const svg = buildSvg(diagram, opts, layout, created_at);

  // Serve SVG inline — browser renders it directly, user can Cmd+P to PDF
  // Content-Disposition: inline means browser shows it, not downloads
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=60",
    },
  });
}

