import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isLocal } from "@/lib/is-local";
import db from "@/lib/db";

// GET /api/diagrams/[id] — public only if is_public=true, else requires auth
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rows } = await db.query("SELECT * FROM diagrams WHERE id = $1", [id]);
  const data = rows[0];
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If not public, require auth (bypass on localhost)
  if (!data.is_public && !isLocal(req)) {
    const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim();
    let authed = false;
    if (bearer) {
      try {
        const payload = JSON.parse(Buffer.from(bearer.split(".")[1], "base64url").toString());
        if (payload.sub && payload.exp > Date.now() / 1000) authed = true;
      } catch { /* ignore */ }
    }
    if (!authed) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(data);
}

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (bearer) {
    try {
      const payload = JSON.parse(Buffer.from(bearer.split(".")[1], "base64url").toString());
      if (payload.sub && payload.exp > Date.now() / 1000) return payload.sub;
    } catch { /* ignore */ }
  }
  // Fallback: cookie-based session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// PATCH /api/diagrams/[id] — update diagram fields (requires auth + ownership)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Build dynamic SET clause from allowed fields
  const allowed = ["title", "code", "tags", "settings", "is_public"];
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  for (const key of allowed) {
    if (body[key] !== undefined) {
      if (key === "tags") {
        setClauses.push(`${key} = $${paramIdx}::text[]`);
      } else if (key === "settings") {
        setClauses.push(`${key} = $${paramIdx}::jsonb`);
      } else {
        setClauses.push(`${key} = $${paramIdx}`);
      }
      values.push(key === "settings" ? JSON.stringify(body[key]) : body[key]);
      paramIdx++;
    }
  }

  if (setClauses.length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 });

  setClauses.push("updated_at = now()");
  values.push(id, userId);

  const sql = `UPDATE diagrams SET ${setClauses.join(", ")} WHERE id = $${paramIdx} AND user_id = $${paramIdx + 1}`;
  const { rowCount } = await db.query(sql, values);
  if (rowCount === 0) return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/diagrams/[id] — delete diagram (requires auth + ownership)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { rowCount } = await db.query(
    "DELETE FROM diagrams WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (rowCount === 0) return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
