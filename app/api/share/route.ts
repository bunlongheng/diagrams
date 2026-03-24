import { NextRequest, NextResponse } from "next/server";
import LZString from "lz-string";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

// POST /api/share — public, no auth, no DB
// Body: { code: string }
// Returns: { url } — compressed ?data= URL ready to open
export async function POST(req: NextRequest) {
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
        return NextResponse.json({ error: "Missing code" }, { status: 400, headers: CORS });
    }

    const compressed = LZString.compressToEncodedURIComponent(code);
    const base = process.env.NEXT_PUBLIC_APP_URL || "https://diagram-bheng.vercel.app";
    const url = `${base}/?data=${compressed}`;

    return NextResponse.json({ url }, { headers: CORS });
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS });
}
