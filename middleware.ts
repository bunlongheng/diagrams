import { NextResponse, type NextRequest } from "next/server";

// Auth is enforced in API routes (lib/auth-owner) and the client shell, not
// here — this middleware is a passthrough that just keeps the matcher
// exclusions consistent (mirrors the Stickies app).
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
