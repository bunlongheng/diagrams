import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// POST /api/share — public, no auth required
// Body: { code: string }
// Returns: { id, url }
export async function POST(req: NextRequest) {
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
        return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const title = code.match(/^(?:title|accTitle):?\s+(.+)$/im)?.[1]?.trim() || "Shared Diagram";
    const slug = "shared-" + Date.now().toString(36);

    const admin = createAdminClient();
    const { data, error } = await admin
        .from("diagrams")
        .insert({ title, slug, code, diagram_type: "sequence", is_shared: true })
        .select("id")
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "https://diagram-bheng.vercel.app";
    return NextResponse.json({ id: data.id, url: `${origin}/d/${data.id}` }, {
        headers: { "Access-Control-Allow-Origin": "*" }
    });
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
}
