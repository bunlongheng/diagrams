import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import db from "@/lib/db";

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}

async function resolveUser(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (bearer) {
    const admin = createAdminClient();
    const { data } = await admin.auth.getUser(bearer);
    if (data.user) return data.user;
  }

  // Fallback: cookie-based session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

// GET /api/diagrams — list diagrams for authenticated user
export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await db.query(
    "SELECT id, title, slug, diagram_type, created_at, updated_at, code, tags FROM diagrams WHERE user_id = $1 ORDER BY updated_at DESC",
    [user.id]
  );
  return NextResponse.json(rows);
}

// POST /api/diagrams — save a diagram (requires auth)
export async function POST(req: NextRequest) {
  const isApiCall = !!req.headers.get("authorization")?.trim();
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = process.env.ALLOWED_EMAIL;
  if (allowed && user.email !== allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, code, diagramType, tags } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!code?.trim()) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const baseSlug = toSlug(title || "untitled");
  let slug = baseSlug;
  let counter = 2;
  while (true) {
    const { rows } = await db.query(
      "SELECT id FROM diagrams WHERE user_id = $1 AND slug = $2 LIMIT 1",
      [user.id, slug]
    );
    if (rows.length === 0) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const finalTags = isApiCall ? [...new Set([...(tags ?? []), "API"])] : (tags ?? []);
  const { rows, rowCount } = await db.query(
    "INSERT INTO diagrams (user_id, title, slug, code, diagram_type, tags) VALUES ($1, $2, $3, $4, $5, $6::text[]) RETURNING *",
    [user.id, title || "Untitled", slug, code, diagramType, finalTags]
  );

  if (rowCount === 0) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  return NextResponse.json(rows[0]);
}
