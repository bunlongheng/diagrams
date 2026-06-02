import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { authorizeOwner, resolveOwnerId } from "@/lib/auth-owner";

// GET /api/diagrams/[id] — public only if is_public=true, else owner-only
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rows } = await db.query("SELECT * FROM diagrams WHERE id = $1", [id]);
  const data = rows[0];
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Private diagrams require owner authorization (local bypass / Bearer / session).
  if (!data.is_public && !(await authorizeOwner(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(data);
}

// PATCH /api/diagrams/[id] — update diagram fields (owner only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveOwnerId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Automation/API integrations may never touch tags — those stay owner-managed.
  const isApiCall = !!req.headers.get("authorization")?.trim();

  // Build dynamic SET clause from allowed fields
  const allowed = isApiCall
    ? ["title", "code", "settings", "is_public"]
    : ["title", "code", "tags", "settings", "is_public"];
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

// DELETE /api/diagrams/[id] — delete diagram (owner only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveOwnerId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { rowCount } = await db.query(
    "DELETE FROM diagrams WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  if (rowCount === 0) return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
