import { NextResponse } from "next/server";
import db from "@/lib/db";
import { parse, buildSvg, DEFAULT_OPTS, DEFAULT_LAYOUT } from "@/lib/svg-renderer";
import type { Opts, Layout } from "@/lib/svg-renderer";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "diagram";
}

// Load Roboto font for resvg (only once)
let fontData: Buffer | null = null;
try { fontData = readFileSync(join(process.cwd(), "public", "fonts", "Roboto-Regular.ttf")); } catch {}

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
  opts.iconMode = "icons";

  const diagram = parse(code);
  let svg = buildSvg(diagram, opts, layout, created_at);

  // Strip emoji
  svg = svg.replace(/>([^<]*)<\/text>/g, (_, text) => {
    const cleaned = text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{200D}]/gu, "").trim();
    return `>${cleaned}</text>`;
  });

  const fontOptions: Record<string, unknown> = {
    loadSystemFonts: true,
    defaultFontFamily: "Arial",
  };
  if (fontData) {
    fontOptions.fontBuffers = [fontData];
  }

  const resvg = new Resvg(svg, {
    font: fontOptions,
    fitTo: { mode: "zoom" as const, value: 4 },
  });
  const pngBuf = Buffer.from(resvg.render().asPng());
  const filename = `${toSlug(title || "diagram")}.png`;

  return new Response(pngBuf, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=60",
    },
  });
}
