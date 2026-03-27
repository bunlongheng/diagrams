import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET /api/diagrams/[id] — public only if is_public=true, else requires auth
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin.from("diagrams").select().eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If not public, require auth
  if (!data.is_public) {
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

// PATCH /api/diagrams/[id] — toggle is_public (requires auth + ownership)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const { is_public } = await req.json();
  const admin = createAdminClient();
  const { error } = await admin.from("diagrams").update({ is_public }).eq("id", id).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
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
