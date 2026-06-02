import { NextRequest, NextResponse } from "next/server";
import { authorizeOwner } from "@/lib/auth-owner";

// Lightweight owner check the client shell/editor use to decide full-access vs
// presenter mode. Reflects the real server gate (local bypass / Bearer / session).
export async function GET(req: NextRequest) {
  return NextResponse.json({ authorized: await authorizeOwner(req) });
}
