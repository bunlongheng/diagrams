import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import db from "@/lib/db";

const AI_SECRET = process.env.AI_API_SECRET;

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}

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
 *   { "id": "…", "url": "https://diagrams-bheng.vercel.app/?id=…", … }
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

  // ── Resolve owner user_id ──────────────────────────────────────────────────
  // OWNER_USER_ID env var bypasses Supabase admin lookup (required for local dev
  // since undici inside Next.js 15 ignores NODE_TLS_REJECT_UNAUTHORIZED=0)
  let ownerId = process.env.OWNER_USER_ID ?? null;
  if (!ownerId) {
    const ownerEmail = process.env.ALLOWED_EMAIL;
    if (!ownerEmail) {
      return NextResponse.json({ error: "OWNER_USER_ID or ALLOWED_EMAIL not configured" }, { status: 500 });
    }
    const admin = createAdminClient();
    const { data: users, error: userErr } = await admin.auth.admin.listUsers();
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
    const owner = users.users.find(u => u.email === ownerEmail);
    if (!owner) return NextResponse.json({ error: "Owner not found" }, { status: 500 });
    ownerId = owner.id;
  }

  // ── Unique slug ───────────────────────────────────────────────────────────
  const baseSlug = toSlug(title);
  let slug = baseSlug;
  let counter = 2;
  while (true) {
    const { rows } = await db.query(
      "SELECT id FROM diagrams WHERE user_id = $1 AND slug = $2 LIMIT 1",
      [ownerId, slug]
    );
    if (rows.length === 0) break;
    slug = `${baseSlug}-${counter++}`;
  }

  // ── Ensure title is embedded in the code ────────────────────────────────
  let finalCode = code.trim();
  if (!/^title:?\s+.+$/im.test(finalCode)) {
    finalCode = finalCode.replace(
      /^(sequenceDiagram[^\n]*\n?)/im,
      `$1    title: ${title.trim()}\n`
    );
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const settings = {
    opts: {
      boxOverlay: "gloss",
      iconMode: "icons",
    },
  };

  const { rows } = await db.query(
    "INSERT INTO diagrams (user_id, title, slug, code, diagram_type, tags, settings) VALUES ($1, $2, $3, $4, $5, $6::text[], $7) RETURNING *",
    [ownerId, title.trim(), slug, finalCode, diagramType, ["API"], JSON.stringify(settings)]
  );

  if (rows.length === 0) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  const diagram = rows[0];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://diagrams-bheng.vercel.app";
  return NextResponse.json(
    { ...diagram, url: `${baseUrl}/d/${diagram.id}`, pdf: `${baseUrl}/pdf/${diagram.id}`, png: `${baseUrl}/png/${diagram.id}`, editor: `${baseUrl}/?id=${diagram.id}` },
    { status: 201 },
  );
}
