import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}

async function resolveUser(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  console.log("[resolveUser] bearer present:", !!bearer, "length:", bearer?.length);

  if (bearer) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(bearer);
    console.log("[resolveUser] getUser result:", data.user?.email, "error:", error?.message);
    if (data.user) return data.user;
  }

  // Fallback: cookie-based session
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  console.log("[resolveUser] cookie user:", user?.email, "error:", error?.message);
  return user ?? null;
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
  const admin = createAdminClient();
  const baseSlug = toSlug(title || "untitled");

  let slug = baseSlug;
  let counter = 2;
  while (true) {
    const { data } = await admin
      .from("diagrams")
      .select("id")
      .eq("user_id", user.id)
      .eq("slug", slug)
      .limit(1);
    if (!data || data.length === 0) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const { data: diagram, error } = await admin
    .from("diagrams")
    .insert({ user_id: user.id, title: title || "Untitled", slug, code, diagram_type: diagramType, tags: isApiCall ? [...new Set([...(tags ?? []), "API"])] : (tags ?? []) })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(diagram);
}

// GET /api/diagrams — list all diagrams for the logged-in admin
export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = process.env.ALLOWED_EMAIL;
  if (allowed && user.email !== allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("diagrams")
    .select("id, title, slug, diagram_type, created_at, code")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
