import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET /api/diagrams/[id] — public, no auth required
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin.from("diagrams").select().eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

// DELETE /api/diagrams/[id] — delete a diagram (requires auth + ownership)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Decode JWT locally — no network call needed, just read sub (user ID)
  let userId: string | null = null;
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (bearer) {
    try {
      const payload = JSON.parse(Buffer.from(bearer.split(".")[1], "base64url").toString());
      if (payload.sub && payload.exp > Date.now() / 1000) userId = payload.sub;
    } catch { /* ignore */ }
  }
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("diagrams").delete().eq("id", id).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
