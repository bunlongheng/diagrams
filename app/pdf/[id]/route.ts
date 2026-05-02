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

  // Fix SVG for sharp/librsvg compatibility:
  // 1. Strip emoji (librsvg can't render them)
  svg = svg.replace(/>([^<]*)<\/text>/g, (_, text) => {
    const cleaned = text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{200D}]/gu, "").trim();
    return `>${cleaned}</text>`;
  });
  // 2. Replace custom fonts with system fonts (librsvg doesn't load web fonts)
  svg = svg.replace(/font-family="'[^']+',\s*sans-serif"/g, 'font-family="Arial, Helvetica, sans-serif"');
  // 3. Replace dominant-baseline (not supported by librsvg) with dy offset
  svg = svg.replace(/dominant-baseline="middle"/g, 'dy="0.35em"');

  // Extract SVG dimensions
  const wMatch = svg.match(/width="(\d+(?:\.\d+)?)"/);
  const hMatch = svg.match(/height="(\d+(?:\.\d+)?)"/);
  const svgW = Math.round(wMatch ? parseFloat(wMatch[1]) : 800);
  const svgH = Math.round(hMatch ? parseFloat(hMatch[1]) : 600);

  // Render SVG → JPEG at 2x for HD quality
  const scale = 4;
  const jpegBuf = await sharp(Buffer.from(svg))
    .resize(svgW * scale, svgH * scale)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 95 })
    .toBuffer();

  const imgW = svgW * scale;
  const imgH = svgH * scale;

  // Build a minimal valid PDF with the JPEG embedded
  // PDF coordinate system: 1 point = 1/72 inch
  // We'll size the page to fit the image at 150 DPI (so it prints well)
  const dpi = 150;
  const pageW = Math.round(imgW / dpi * 72);
  const pageH = Math.round(imgH / dpi * 72);

  const imgStream = jpegBuf;
  const imgLen = imgStream.length;

  // Build PDF byte by byte
  const lines: (string | Buffer)[] = [];
  const offsets: number[] = [];
  let pos = 0;

  const addLine = (s: string) => { lines.push(s + "\n"); pos += s.length + 1; };
  const addBuf = (b: Buffer) => { lines.push(b); pos += b.length; };
  const markObj = () => { offsets.push(pos); };

  addLine("%PDF-1.4");

  // Object 1: Catalog
  markObj();
  addLine("1 0 obj");
  addLine("<< /Type /Catalog /Pages 2 0 R >>");
  addLine("endobj");

  // Object 2: Pages
  markObj();
  addLine("2 0 obj");
  addLine(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
  addLine("endobj");

  // Object 3: Page
  markObj();
  addLine("3 0 obj");
  addLine(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 5 0 R /Resources << /XObject << /Img 4 0 R >> >> >>`);
  addLine("endobj");

  // Object 4: Image XObject (JPEG)
  markObj();
  addLine("4 0 obj");
  addLine(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgLen} >>`);
  addLine("stream");
  addBuf(imgStream);
  addLine("\nendstream");
  addLine("endobj");

  // Object 5: Page contents (draw image scaled to page)
  const contentStream = `q ${pageW} 0 0 ${pageH} 0 0 cm /Img Do Q`;
  markObj();
  addLine("5 0 obj");
  addLine(`<< /Length ${contentStream.length} >>`);
  addLine("stream");
  addLine(contentStream);
  addLine("endstream");
  addLine("endobj");

  // Cross-reference table
  const xrefPos = pos;
  addLine("xref");
  addLine(`0 ${offsets.length + 1}`);
  addLine("0000000000 65535 f ");
  for (const off of offsets) {
    addLine(String(off).padStart(10, "0") + " 00000 n ");
  }

  addLine("trailer");
  addLine(`<< /Size ${offsets.length + 1} /Root 1 0 R >>`);
  addLine("startxref");
  addLine(String(xrefPos));
  addLine("%%EOF");

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
