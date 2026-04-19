import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

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
  // This app renders sequence diagrams with a custom SVG renderer.
  // Flowcharts, architecture, class, ER, gantt, pie, mindmap, etc. are NOT supported.
  // For mindmaps, use https://mindmaps-bheng.vercel.app/api/ai/mindmaps instead.
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

  // ── Resolve owner user_id from ALLOWED_EMAIL ──────────────────────────────
  const ownerEmail = process.env.ALLOWED_EMAIL;
  if (!ownerEmail) {
    return NextResponse.json({ error: "ALLOWED_EMAIL not configured" }, { status: 500 });
  }
  const admin = createAdminClient();
  const { data: users, error: userErr } = await admin.auth.admin.listUsers();
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
  const owner = users.users.find(u => u.email === ownerEmail);
  if (!owner) return NextResponse.json({ error: "Owner not found" }, { status: 500 });

  // ── Unique slug ───────────────────────────────────────────────────────────
  const baseSlug = toSlug(title);
  let slug = baseSlug;
  let counter = 2;
  while (true) {
    const { data } = await admin.from("diagrams").select("id").eq("user_id", owner.id).eq("slug", slug).limit(1);
    if (!data || data.length === 0) break;
    slug = `${baseSlug}-${counter++}`;
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const settings = {
    opts: {
      boxOverlay: "gloss",
      iconMode: "icons",
    },
  };

  const { data: diagram, error } = await admin
    .from("diagrams")
    .insert({
      user_id: owner.id,
      title: title.trim(),
      slug,
      code: code.trim(),
      diagram_type: diagramType,

      tags: ["API"],
      settings,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://diagrams-bheng.vercel.app";
  return NextResponse.json(
    { ...diagram, url: `${baseUrl}/?id=${diagram.id}` },
    { status: 201 },
  );
}
