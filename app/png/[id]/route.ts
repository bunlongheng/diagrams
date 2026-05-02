import { NextResponse } from "next/server";
import db from "@/lib/db";
import { parse, buildSvg, DEFAULT_OPTS, DEFAULT_LAYOUT } from "@/lib/svg-renderer";
import type { Opts, Layout } from "@/lib/svg-renderer";
import sharp from "sharp";

export const dynamic = "force-dynamic";

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "diagram";
}

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

  // Strip emoji that sharp/librsvg can't render
  svg = svg.replace(/>([^<]*)<\/text>/g, (_, text) => {
    const cleaned = text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{200D}]/gu, "").trim();
    return `>${cleaned}</text>`;
  });

  const wMatch = svg.match(/width="(\d+(?:\.\d+)?)"/);
  const hMatch = svg.match(/height="(\d+(?:\.\d+)?)"/);
  const svgW = Math.round(wMatch ? parseFloat(wMatch[1]) : 800);
  const svgH = Math.round(hMatch ? parseFloat(hMatch[1]) : 600);

  const scale = 4;
  const pngBuf = await sharp(Buffer.from(svg))
    .resize(svgW * scale, svgH * scale)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  const filename = `${toSlug(title || "diagram")}.png`;

  return new Response(pngBuf, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=60",
    },
  });
}
