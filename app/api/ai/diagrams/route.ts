import { NextRequest, NextResponse } from "next/server";
import { ownerId } from "@/lib/auth-owner";
import db from "@/lib/db";
import { uniqueDiagramSlug } from "@/lib/slugs";

const AI_SECRET = process.env.AI_API_SECRET;

/**
 * POST /api/ai/diagrams
 *
 * ONLY sequence diagrams are accepted. Flowcharts, architecture,
 * class, ER, gantt, pie, mindmap, etc. will be rejected with 400.
 *
 * Creates a diagram on behalf of the owner with:
 *   - boxOverlay  = "gloss"
 *   - iconMode    = "icons"
 *
 * Headers:
 *   Authorization: Bearer <AI_API_SECRET>
 *
 * Body (JSON):
 *   {
 *     "title":       "My Diagram",          // required
 *     "code":        "sequenceDiagram\n…",  // required
 *     "diagramType": "sequence"             // optional, defaults to "sequence"
 *   }
 *
 * Response 201:
 *   { "svg": "https://diagrams-bheng.vercel.app/svg/…" }
 *
 * The svg URL is the only field returned — vector, sharp at any zoom,
 * suitable for embedding in Confluence (Cloud), Notion, docs, etc.
 */
export async function POST(req: NextRequest) {
  try {
  return await postHandler(req);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ai/diagrams] unhandled error:", msg);
    return NextResponse.json({ error: "Internal error", detail: msg }, { status: 500 });
  }
}

async function postHandler(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  if (!AI_SECRET) {
    return NextResponse.json({ error: "AI_API_SECRET not configured" }, { status: 500 });
  }
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer !== AI_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  let body: { title?: string; code?: string; diagramType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({
      error: "Invalid JSON body",
      instruction: "Send a valid JSON body with Content-Type: application/json. The body MUST include \"title\" and \"code\" fields.",
      required_fields: {
        title: "string — A descriptive name for the diagram (e.g. \"User Authentication Flow\")",
        code: "string — Valid Mermaid syntax for the diagram",
      },
      optional_fields: {
        diagramType: "string — One of: sequence, flowchart, classDiagram, erDiagram, gantt, pie, mindmap, timeline, etc. Defaults to \"sequence\"",
      },
      sample_request: {
        body: {
          title: "User Authentication Flow",
          diagramType: "sequence",
          code: "---\ntitle: User Authentication Flow\n---\nsequenceDiagram\n  participant U as 🧑 User\n  participant S as ⚙️ Server\n  U->>S: Login Request\n  S-->>U: JWT Token",
        },
      },
    }, { status: 400 });
  }

  const { title, code, diagramType = "sequence" } = body;

  // ── ONLY sequence diagrams are supported ──────────────────────────────────
  if (diagramType && diagramType !== "sequence") {
    return NextResponse.json({
      error: `Unsupported diagram type: "${diagramType}". This app ONLY supports sequence diagrams.`,
      supported: "sequence",
      rejected: diagramType,
      hint: "For mindmaps, use POST https://mindmaps-bheng.vercel.app/api/ai/mindmaps. For other diagram types, this app is not the right tool.",
    }, { status: 400 });
  }

  // Also reject code that isn't a sequence diagram
  if (code?.trim() && !/sequenceDiagram/i.test(code)) {
    return NextResponse.json({
      error: "Only sequenceDiagram code is accepted. The code must contain 'sequenceDiagram'.",
      hint: "Flowcharts, architecture diagrams, class diagrams, etc. are NOT supported. Only Mermaid sequenceDiagram syntax.",
      sample_code: "---\ntitle: My Flow\n---\nsequenceDiagram\n  participant U as 🧑 User\n  participant S as ⚙️ Server\n  U->>S: Request\n  S-->>U: Response",
    }, { status: 400 });
  }

  if (!title?.trim()) return NextResponse.json({
    error: "Missing required field: title",
    instruction: "You MUST include a \"title\" field in your JSON body. The title describes what the diagram is about.",
    supported_type: "sequence ONLY — no flowcharts, architecture, class, ER, gantt, pie, or mindmap diagrams",
    required_fields: {
      title: "string — A descriptive name for the diagram (e.g. \"User Authentication Flow\")",
      code: "string — Valid Mermaid sequenceDiagram syntax ONLY",
    },
    sample_request: {
      method: "POST",
      url: "/api/ai/diagrams",
      headers: {
        "Authorization": "Bearer <YOUR_API_SECRET>",
        "Content-Type": "application/json",
      },
      body: {
        title: "User Authentication Flow",
        diagramType: "sequence",
        code: "---\ntitle: User Authentication Flow\n---\nsequenceDiagram\n  participant U as 🧑 User\n  participant S as ⚙️ Server\n  U->>S: Login Request\n  S-->>U: JWT Token",
      },
    },
  }, { status: 400 });

  if (!code?.trim()) return NextResponse.json({
    error: "Missing required field: code",
    instruction: "You MUST include a \"code\" field containing valid Mermaid sequenceDiagram syntax. No other diagram types.",
    sample_request: {
      body: {
        title: "User Authentication Flow",
        diagramType: "sequence",
        code: "---\ntitle: User Authentication Flow\n---\nsequenceDiagram\n  participant U as 🧑 User\n  participant S as ⚙️ Server\n  U->>S: Login Request\n  S-->>U: JWT Token",
      },
    },
  }, { status: 400 });

  // ── Resolve owner user_id (legacy Supabase UUID via OWNER_USER_ID) ─────────
  const ownerUserId = ownerId();
  if (!ownerUserId) {
    return NextResponse.json({ error: "OWNER_USER_ID not configured" }, { status: 500 });
  }

  // ── Unique slug ───────────────────────────────────────────────────────────
  const slug = await uniqueDiagramSlug(ownerUserId, title);

  // ── Ensure title is embedded in the code ────────────────────────────────
  let finalCode = code.trim();
  if (!/^title:?\s+.+$/im.test(finalCode)) {
    finalCode = finalCode.replace(
      /^(sequenceDiagram[^\n]*\n?)/im,
      `$1    title: ${title.trim()}\n`
    );
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  // vPad: 50 gives breathing room between pills so API-rendered SVGs never
  // overlap, regardless of message-text or pill heights.
  const settings = {
    opts: {
      boxOverlay: "gloss",
      iconMode: "icons",
    },
    layout: {
      vPad: 50,
    },
  };

  const { rows } = await db.query(
    "INSERT INTO diagrams (user_id, title, slug, code, diagram_type, tags, settings) VALUES ($1, $2, $3, $4, $5, $6::text[], $7) RETURNING *",
    [ownerUserId, title.trim(), slug, finalCode, diagramType, ["API"], JSON.stringify(settings)]
  );

  if (rows.length === 0) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  const diagram = rows[0];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://diagrams-bheng.vercel.app";
  return NextResponse.json(
    { svg: `${baseUrl}/svg/${diagram.id}` },
    { status: 201 },
  );
}
