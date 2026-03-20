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
  // Dev bypass: look up the first user via admin client, no auth required
  if (process.env.LOCAL_DEV === "true") {
    const admin = createAdminClient();
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1 });
    const devUser = users?.users?.[0];
    if (!devUser) return NextResponse.json({ error: "No users in dev DB" }, { status: 500 });
    const { title, code, diagramType } = await req.json();
    const baseSlug = toSlug(title || "untitled");
    let slug = baseSlug; let counter = 2;
    while (true) {
      const { data } = await admin.from("diagrams").select("id").eq("slug", slug).limit(1);
      if (!data || data.length === 0) break;
      slug = `${baseSlug}-${counter}`; counter++;
    }
    const { data: diagram, error } = await admin.from("diagrams")
      .insert({ user_id: devUser.id, title: title || "Untitled", slug, code, diagram_type: diagramType })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(diagram);
  }

  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = process.env.ALLOWED_EMAIL;
  if (allowed && user.email !== allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, code, diagramType } = await req.json();
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
    .insert({ user_id: user.id, title: title || "Untitled", slug, code, diagram_type: diagramType })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(diagram);
}

// GET /api/diagrams — list all diagrams for the logged-in admin
export async function GET(req: NextRequest) {
  // Dev bypass: direct REST call (bypasses Node fetch / Supabase JS client quirks)
  if (process.env.LOCAL_DEV === "true") {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/diagrams?select=id,title,slug,diagram_type,created_at,code&order=created_at.desc`;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const data = await res.json();
    return NextResponse.json(Array.isArray(data) ? data : []);
  }

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
