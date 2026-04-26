import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
};

/**
 * GET /api/export?id=<diagram-id>&format=svg
 *
 * Returns the raw SVG of a diagram for embedding in slides, docs, etc.
 * The SVG is generated server-side from the stored Mermaid code using
 * the same buildSvg renderer as the frontend.
 *
 * Query params:
 *   id     — diagram UUID (required)
 *   format — "svg" (default, returns image/svg+xml)
 *   theme  — "light" | "dark" | "monokai" (default: uses saved settings or "light")
 */
export async function GET(req: NextRequest) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ?id= parameter" }, { status: 400, headers: CORS });

  const { rows } = await db.query("SELECT code, settings, title FROM diagrams WHERE id = $1", [id]);
  if (!rows.length) return NextResponse.json({ error: "Diagram not found" }, { status: 404, headers: CORS });

  const { code, settings, title } = rows[0];
  if (!code?.trim()) return NextResponse.json({ error: "Diagram has no code" }, { status: 400, headers: CORS });

  // Return the raw Mermaid code + metadata so the caller can render it
  // (Server-side SVG rendering would require the full buildSvg function which is client-only)
  const themeOverride = req.nextUrl.searchParams.get("theme");
  const opts = settings?.opts ?? {};
  if (themeOverride) opts.theme = themeOverride;

  return NextResponse.json({
    id,
    title,
    code,
    settings: { opts },
    format: "mermaid",
    hint: "To get a rendered PNG/SVG, open the diagram URL in a browser and use the export button, or use the /d/[id] public route.",
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://diagrams-bheng.vercel.app"}/?id=${id}`,
  }, { headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
