import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { uniqueDiagramSlug } from "@/lib/slugs";
import { resolveOwnerId } from "@/lib/auth-owner";

// Accepts a bare 11-char video ID or any YouTube URL (watch?v=, youtu.be/,
// /shorts/, /embed/) and returns the canonical video ID, else null.
function extractYouTubeId(input?: string | null): string | null {
  if (!input || typeof input !== "string") return null;
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// GET /api/diagrams — list diagrams for the owner
export async function GET(req: NextRequest) {
  const userId = await resolveOwnerId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await db.query(
    "SELECT id, title, slug, diagram_type, created_at, updated_at, code, tags, settings->>'youtubeId' AS youtube_id FROM diagrams WHERE user_id = $1 ORDER BY updated_at DESC",
    [userId]
  );
  return NextResponse.json(rows);
}

// POST /api/diagrams — save a diagram (owner only)
export async function POST(req: NextRequest) {
  const isApiCall = !!req.headers.get("authorization")?.trim();
  const userId = await resolveOwnerId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, code, diagramType, tags, youtubeId, youtubeUrl } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!code?.trim()) return NextResponse.json({ error: "code is required" }, { status: 400 });

  // YouTube automations post titles prefixed with "YT:". Strip the prefix and
  // file them under a "YouTube" tag; all other automations get "Automations".
  // The "YT:" prefix is the source marker, never stored in the title itself.
  const ytId = extractYouTubeId(youtubeId ?? youtubeUrl);
  const isYouTube = isApiCall && (/^YT:\s*/i.test(title) || !!ytId);
  const cleanTitle = title.replace(/^YT:\s*/i, "").trim() || "Untitled";

  const slug = await uniqueDiagramSlug(userId, cleanTitle);

  // Automation/API integrations never get to set their own tags — caller tags
  // are honored only for the owner's own UI requests (no Authorization header).
  const finalTags = isApiCall ? (isYouTube ? ["YouTube"] : ["Automations"]) : (tags ?? []);
  const settings = ytId ? JSON.stringify({ youtubeId: ytId }) : null;
  const { rows, rowCount } = await db.query(
    "INSERT INTO diagrams (user_id, title, slug, code, diagram_type, tags, settings) VALUES ($1, $2, $3, $4, $5, $6::text[], $7::jsonb) RETURNING *",
    [userId, cleanTitle, slug, code, diagramType, finalTags, settings]
  );

  if (rowCount === 0) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  return NextResponse.json(rows[0]);
}
