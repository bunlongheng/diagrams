import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

function extractTitle(code: string): string {
  const m = code.match(/^\s*(?:title|accTitle):?\s+(.+)$/im);
  if (m) return m[1].trim();
  return "";
}

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("diagrams")
    .select("id, title, code")
    .eq("title", "Untitled");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const updates: { id: string; old: string; new: string }[] = [];

  for (const d of data ?? []) {
    const extracted = extractTitle(d.code);
    if (!extracted) continue;
    await admin.from("diagrams").update({ title: extracted }).eq("id", d.id);
    updates.push({ id: d.id, old: d.title, new: extracted });
  }

  return NextResponse.json({ fixed: updates.length, updates });
}
