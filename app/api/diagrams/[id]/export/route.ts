import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const AI_SECRET = process.env.AI_API_SECRET;

/**
 * GET /api/diagrams/[id]/export
 *
 * Returns diagram data and renders SVG via mermaid.ink (Mermaid's official
 * cloud renderer). mermaid.ink uses a real browser engine so text metrics
 * and layout are correct — server-side DOM polyfills cannot replicate this.
 *
 * Headers:
 *   Authorization: Bearer <AI_API_SECRET>
 *
 * Response 200:
 *   { "id": "…", "title": "…", "code": "…", "svg": "<svg>…</svg>", "inkUrl": "…" }
 *
 * Response 200 (if mermaid.ink is unreachable):
 *   { "id": "…", "title": "…", "code": "…", "svg": null }
 *   — deck-gen.mjs falls back to inline mermaid CDN rendering
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  // ── Auth ──────────────────────────────────────────────────────────────────
  if (!AI_SECRET) {
    return NextResponse.json({ error: "AI_API_SECRET not configured" }, { status: 500 });
  }
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer !== AI_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // ── Fetch diagram ─────────────────────────────────────────────────────────
  const { rows } = await db.query("SELECT * FROM diagrams WHERE id = $1", [id]);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Diagram not found" }, { status: 404 });
  }
  const diagram = rows[0];

  // ── Render via mermaid.ink ────────────────────────────────────────────────
  // mermaid.ink renders with a real browser — supports getBBox, text metrics, etc.
  let svg: string | null = null;
  let inkUrl: string | null = null;

  try {
    // mermaid.ink expects base64url-encoded Mermaid code
    const encoded = Buffer.from(diagram.code, "utf8").toString("base64url");
    inkUrl = `https://mermaid.ink/svg/${encoded}`;

    svg = await fetchSVG(inkUrl);
    console.log(`[export] svg result: ${svg?.length ?? 'null'} bytes for diagram ${id}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[export] mermaid.ink fetch failed: ${msg}`);
  }

  return NextResponse.json({
    id: diagram.id,
    title: diagram.title,
    code: diagram.code,
    diagramType: diagram.diagram_type,
    inkUrl,
    svg,
  });
  } catch (outerErr: unknown) {
    const msg = outerErr instanceof Error ? outerErr.message : String(outerErr);
    console.error("[export] outer catch:", msg);
    return NextResponse.json({ error: "Internal error", detail: msg }, { status: 500 });
  }
}

// ── Fetch SVG using Node's https module (respects NODE_TLS_REJECT_UNAUTHORIZED) ─
function fetchSVG(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    // Ensure TLS verification is disabled for local dev
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    import("node:https").then(({ default: https }) => {
      const req = https.get(url, { headers: { "User-Agent": "diagrams-bheng-export/1.0" } }, (res) => {
        if (res.statusCode !== 200) {
          console.warn(`[export] mermaid.ink returned ${res.statusCode}`);
          res.resume();
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      });
      req.on("error", (err) => {
        console.warn(`[export] https.get error: ${err.message}`);
        resolve(null);
      });
      req.setTimeout(15_000, () => {
        req.destroy();
        resolve(null);
      });
    }).catch(() => resolve(null));
  });
}
