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

  // Render SVG → PNG via resvg (handles fonts properly)
  const fontOptions: Record<string, unknown> = {
    loadSystemFonts: true,
    defaultFontFamily: "Arial",
  };
  if (fontData) fontOptions.fontBuffers = [fontData];

  const wMatch = svg.match(/width="(\d+(?:\.\d+)?)"/);
  const hMatch = svg.match(/height="(\d+(?:\.\d+)?)"/);
  const svgW = Math.round(wMatch ? parseFloat(wMatch[1]) : 800);
  const svgH = Math.round(hMatch ? parseFloat(hMatch[1]) : 600);

  const resvg = new Resvg(svg, {
    font: fontOptions,
    fitTo: { mode: "zoom" as const, value: 4 },
  });
  const jpegBuf = Buffer.from(resvg.render().asPng());

  const imgW = svgW * 4;
  const imgH = svgH * 4;

  // Build minimal PDF with the image
  const dpi = 150;
  const pageW = Math.round(imgW / dpi * 72);
  const pageH = Math.round(imgH / dpi * 72);

  // Use sharp to convert PNG → JPEG for smaller PDF
  const sharp = (await import("sharp")).default;
  const jpegForPdf = await sharp(jpegBuf).jpeg({ quality: 95 }).toBuffer();
  const imgLen = jpegForPdf.length;

  const lines: (string | Buffer)[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const addLine = (s: string) => { lines.push(s + "\n"); pos += s.length + 1; };
  const addBuf = (b: Buffer) => { lines.push(b); pos += b.length; };
  const markObj = () => { offsets.push(pos); };

  addLine("%PDF-1.4");
  markObj(); addLine("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  markObj(); addLine(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`);
  markObj(); addLine(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 5 0 R /Resources << /XObject << /Img 4 0 R >> >> >>\nendobj`);
  markObj(); addLine("4 0 obj"); addLine(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgLen} >>`); addLine("stream"); addBuf(jpegForPdf); addLine("\nendstream"); addLine("endobj");
  const cs = `q ${pageW} 0 0 ${pageH} 0 0 cm /Img Do Q`;
  markObj(); addLine("5 0 obj"); addLine(`<< /Length ${cs.length} >>`); addLine("stream"); addLine(cs); addLine("endstream"); addLine("endobj");

  const xrefPos = pos;
  addLine("xref"); addLine(`0 ${offsets.length + 1}`); addLine("0000000000 65535 f ");
  for (const off of offsets) addLine(String(off).padStart(10, "0") + " 00000 n ");
  addLine("trailer"); addLine(`<< /Size ${offsets.length + 1} /Root 1 0 R >>`); addLine("startxref"); addLine(String(xrefPos)); addLine("%%EOF");

  const pdfBuf = Buffer.concat(lines.map(l => typeof l === "string" ? Buffer.from(l) : l));
  const filename = `${toSlug(title || "diagram")}.pdf`;

  return new Response(pdfBuf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=60",
    },
  });
}
