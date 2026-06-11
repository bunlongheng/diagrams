/**
 * API Route Handler Tests
 *
 * Tests all route handlers without hitting real DB or Anthropic.
 * Auth is via @/lib/auth-owner mocks (no Supabase).
 * The ai/diagrams and [id]/export routes read AI_SECRET at module scope,
 * so they require dynamic import after vi.stubEnv + vi.resetModules.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module-level mocks (hoisted before imports) ──────────────────────────────
vi.mock("@/lib/auth-owner", () => ({
  authorizeOwner: vi.fn(),
  resolveOwnerId: vi.fn(),
  ownerId: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: { query: vi.fn() } }));

vi.mock("@/lib/slugs", () => ({
  uniqueDiagramSlug: vi.fn().mockResolvedValue("slug-1"),
}));

// ── Imports after mocks ──────────────────────────────────────────────────────
import db from "@/lib/db";
import { authorizeOwner, resolveOwnerId, ownerId } from "@/lib/auth-owner";

const q = db.query as unknown as ReturnType<typeof vi.fn>;
const mockAuthorizeOwner = authorizeOwner as unknown as ReturnType<typeof vi.fn>;
const mockResolveOwnerId = resolveOwnerId as unknown as ReturnType<typeof vi.fn>;
const mockOwnerId = ownerId as unknown as ReturnType<typeof vi.fn>;

// ── Default beforeEach ────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockResolveOwnerId.mockResolvedValue(null);
  mockAuthorizeOwner.mockResolvedValue(false);
  mockOwnerId.mockReturnValue("owner-uuid");
  q.mockResolvedValue({ rows: [], rowCount: 0 });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/diagrams
// ════════════════════════════════════════════════════════════════════════════
describe("GET /api/diagrams", () => {
  it("returns 401 when resolveOwnerId returns null", async () => {
    const { GET } = await import("@/app/api/diagrams/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with rows when resolveOwnerId returns a user id", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    q.mockResolvedValue({ rows: [{ id: 1, title: "Test" }], rowCount: 1 });

    const { GET } = await import("@/app/api/diagrams/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/diagrams
// ════════════════════════════════════════════════════════════════════════════
describe("POST /api/diagrams", () => {
  it("returns 401 when resolveOwnerId returns null", async () => {
    const { POST } = await import("@/app/api/diagrams/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "T", code: "C" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when title is missing", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    const { POST } = await import("@/app/api/diagrams/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "sequenceDiagram\nA->>B: hi" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when code is missing", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    const { POST } = await import("@/app/api/diagrams/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "My Diagram" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with the inserted row on valid request", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    q.mockResolvedValue({ rows: [{ id: "d1", title: "My Diagram" }], rowCount: 1 });

    const { POST } = await import("@/app/api/diagrams/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "My Diagram", code: "sequenceDiagram\nA->>B: hi" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("d1");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/diagrams/[id]
// ════════════════════════════════════════════════════════════════════════════
describe("GET /api/diagrams/[id]", () => {
  it("returns 404 when diagram not found", async () => {
    const { GET } = await import("@/app/api/diagrams/[id]/route");
    q.mockResolvedValue({ rows: [], rowCount: 0 });
    const req = new NextRequest("http://localhost:3002/api/diagrams/some-id");
    const res = await GET(req, { params: Promise.resolve({ id: "some-id" }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 for a public diagram (no auth needed)", async () => {
    const { GET } = await import("@/app/api/diagrams/[id]/route");
    q.mockResolvedValue({ rows: [{ id: "d1", title: "T", is_public: true }], rowCount: 1 });
    const req = new NextRequest("http://example.com/api/diagrams/d1");
    const res = await GET(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("d1");
  });

  it("returns 403 for private diagram when authorizeOwner returns false", async () => {
    const { GET } = await import("@/app/api/diagrams/[id]/route");
    mockAuthorizeOwner.mockResolvedValue(false);
    q.mockResolvedValue({ rows: [{ id: "d1", title: "T", is_public: false }], rowCount: 1 });
    const req = new NextRequest("http://example.com/api/diagrams/d1");
    const res = await GET(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 200 for private diagram when authorizeOwner returns true", async () => {
    const { GET } = await import("@/app/api/diagrams/[id]/route");
    mockAuthorizeOwner.mockResolvedValue(true);
    q.mockResolvedValue({ rows: [{ id: "d1", title: "T", is_public: false }], rowCount: 1 });
    const req = new NextRequest("http://example.com/api/diagrams/d1");
    const res = await GET(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/diagrams/[id]
// ════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/diagrams/[id]", () => {
  it("returns 401 when resolveOwnerId returns null", async () => {
    const { PATCH } = await import("@/app/api/diagrams/[id]/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams/d1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "new" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 when body has no allowed fields", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    const { PATCH } = await import("@/app/api/diagrams/[id]/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams/d1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 200 {ok:true} when update succeeds (rowCount 1)", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    q.mockResolvedValue({ rows: [], rowCount: 1 });
    const { PATCH } = await import("@/app/api/diagrams/[id]/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams/d1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 404 when rowCount is 0 (not found or not owner)", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    q.mockResolvedValue({ rows: [], rowCount: 0 });
    const { PATCH } = await import("@/app/api/diagrams/[id]/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams/d1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DELETE /api/diagrams/[id]
// ════════════════════════════════════════════════════════════════════════════
describe("DELETE /api/diagrams/[id]", () => {
  it("returns 401 when resolveOwnerId returns null", async () => {
    const { DELETE } = await import("@/app/api/diagrams/[id]/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams/d1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when diagram not found or not owned (rowCount 0)", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    q.mockResolvedValue({ rows: [], rowCount: 0 });
    const { DELETE } = await import("@/app/api/diagrams/[id]/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams/d1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 {ok:true} when delete succeeds (rowCount 1)", async () => {
    mockResolveOwnerId.mockResolvedValue("u1");
    q.mockResolvedValue({ rows: [], rowCount: 1 });
    const { DELETE } = await import("@/app/api/diagrams/[id]/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams/d1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/ai/generate
// ════════════════════════════════════════════════════════════════════════════
describe("POST /api/ai/generate", () => {
  it("returns 401 when authorizeOwner returns false", async () => {
    mockAuthorizeOwner.mockResolvedValue(false);
    const { POST } = await import("@/app/api/ai/generate/route");
    const req = new NextRequest("http://example.com/api/ai/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "draw me a diagram" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when prompt is missing", async () => {
    mockAuthorizeOwner.mockResolvedValue(true);
    const { POST } = await import("@/app/api/ai/generate/route");
    const req = new NextRequest("http://localhost:3002/api/ai/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is invalid JSON", async () => {
    mockAuthorizeOwner.mockResolvedValue(true);
    const { POST } = await import("@/app/api/ai/generate/route");
    const req = new NextRequest("http://localhost:3002/api/ai/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // NOTE: success path is NOT tested -- it calls the real Anthropic API.
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/auth/me
// ════════════════════════════════════════════════════════════════════════════
describe("GET /api/auth/me", () => {
  it("returns 200 with {authorized:true} when authorizeOwner is true", async () => {
    mockAuthorizeOwner.mockResolvedValue(true);
    const { GET } = await import("@/app/api/auth/me/route");
    const req = new NextRequest("http://localhost:3002/api/auth/me");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(true);
  });

  it("returns 200 with {authorized:false} when authorizeOwner is false", async () => {
    mockAuthorizeOwner.mockResolvedValue(false);
    const { GET } = await import("@/app/api/auth/me/route");
    const req = new NextRequest("http://example.com/api/auth/me");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/ai/diagrams  (module reads AI_SECRET at import time)
// ════════════════════════════════════════════════════════════════════════════
describe("POST /api/ai/diagrams", () => {
  const SECRET = "topsecret";

  it("returns 500 when AI_API_SECRET is not set", async () => {
    vi.stubEnv("AI_API_SECRET", "");
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/diagrams/route");
    const req = new NextRequest("http://localhost:3002/api/ai/diagrams", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ title: "T", code: "sequenceDiagram\nA->>B: hi", diagramType: "sequence" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    vi.unstubAllEnvs();
  });

  it("returns 401 when bearer token is wrong", async () => {
    vi.stubEnv("AI_API_SECRET", SECRET);
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/diagrams/route");
    const req = new NextRequest("http://localhost:3002/api/ai/diagrams", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer wrongsecret" },
      body: JSON.stringify({ title: "T", code: "sequenceDiagram\nA->>B: hi", diagramType: "sequence" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 400 when body is invalid JSON", async () => {
    vi.stubEnv("AI_API_SECRET", SECRET);
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/diagrams/route");
    const req = new NextRequest("http://localhost:3002/api/ai/diagrams", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: "{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 for unsupported diagramType (flowchart)", async () => {
    vi.stubEnv("AI_API_SECRET", SECRET);
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/diagrams/route");
    const req = new NextRequest("http://localhost:3002/api/ai/diagrams", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ title: "T", code: "sequenceDiagram\nA->>B: hi", diagramType: "flowchart" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 when code does not contain sequenceDiagram", async () => {
    vi.stubEnv("AI_API_SECRET", SECRET);
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/diagrams/route");
    const req = new NextRequest("http://localhost:3002/api/ai/diagrams", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ title: "T", code: "graph LR\nA-->B", diagramType: "sequence" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 when title is missing", async () => {
    vi.stubEnv("AI_API_SECRET", SECRET);
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/diagrams/route");
    const req = new NextRequest("http://localhost:3002/api/ai/diagrams", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ code: "sequenceDiagram\nA->>B: hi", diagramType: "sequence" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("returns 400 when code is missing", async () => {
    vi.stubEnv("AI_API_SECRET", SECRET);
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/diagrams/route");
    const req = new NextRequest("http://localhost:3002/api/ai/diagrams", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ title: "My Flow", diagramType: "sequence" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/export
// ════════════════════════════════════════════════════════════════════════════
describe("GET /api/export", () => {
  it("returns 400 when id is missing", async () => {
    const { GET } = await import("@/app/api/export/route");
    const req = new NextRequest("http://localhost:3002/api/export");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when id is not a valid UUID", async () => {
    const { GET } = await import("@/app/api/export/route");
    const req = new NextRequest("http://localhost:3002/api/export?id=abc");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when diagram not found", async () => {
    const { GET } = await import("@/app/api/export/route");
    q.mockResolvedValue({ rows: [], rowCount: 0 });
    const req = new NextRequest("http://localhost:3002/api/export?id=00000000-0000-0000-0000-000000000000");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns 200 with code when diagram exists", async () => {
    const { GET } = await import("@/app/api/export/route");
    q.mockResolvedValue({
      rows: [{ code: "sequenceDiagram\nA->>B: hi", settings: {}, title: "Test" }],
      rowCount: 1,
    });
    const req = new NextRequest("http://localhost:3002/api/export?id=00000000-0000-0000-0000-000000000000");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBeDefined();
  });

  it("OPTIONS returns 204", async () => {
    const { OPTIONS } = await import("@/app/api/export/route");
    const res = await OPTIONS();
    expect(res.status).toBe(204);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/lan-ip
// ════════════════════════════════════════════════════════════════════════════
describe("GET /api/lan-ip", () => {
  it("returns 200 with ip property", async () => {
    const { GET } = await import("@/app/api/lan-ip/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect("ip" in body).toBe(true);
    expect(body.ip === null || typeof body.ip === "string").toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /svg/[id]
// ════════════════════════════════════════════════════════════════════════════
describe("GET /svg/[id]", () => {
  it("returns 400 for invalid UUID", async () => {
    const { GET } = await import("@/app/svg/[id]/route");
    const req = new Request("http://localhost:3002/svg/invalid-id");
    const res = await GET(req, { params: Promise.resolve({ id: "invalid-id" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when diagram not found", async () => {
    const { GET } = await import("@/app/svg/[id]/route");
    q.mockResolvedValue({ rows: [], rowCount: 0 });
    const req = new Request("http://localhost:3002/svg/00000000-0000-0000-0000-000000000000");
    const res = await GET(req, { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 with image/svg+xml content-type for valid diagram", async () => {
    const { GET } = await import("@/app/svg/[id]/route");
    q.mockResolvedValue({
      rows: [{
        code: "sequenceDiagram\nA->>B: hi",
        settings: null,
        title: "Test",
        created_at: new Date().toISOString(),
      }],
      rowCount: 1,
    });
    const req = new Request("http://localhost:3002/svg/00000000-0000-0000-0000-000000000000");
    const res = await GET(req, { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/diagrams/[id]/export  (module reads AI_SECRET at import time)
// ════════════════════════════════════════════════════════════════════════════
describe("GET /api/diagrams/[id]/export", () => {
  const SECRET = "exportsecret";

  it("returns 500 when AI_API_SECRET is not set", async () => {
    vi.stubEnv("AI_API_SECRET", "");
    vi.resetModules();
    const { GET } = await import("@/app/api/diagrams/[id]/export/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams/d1/export", {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(500);
    vi.unstubAllEnvs();
  });

  it("returns 401 when bearer token is wrong", async () => {
    vi.stubEnv("AI_API_SECRET", SECRET);
    vi.resetModules();
    const { GET } = await import("@/app/api/diagrams/[id]/export/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams/d1/export", {
      headers: { authorization: "Bearer wrongtoken" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("returns 404 when diagram not found", async () => {
    vi.stubEnv("AI_API_SECRET", SECRET);
    vi.resetModules();
    q.mockResolvedValue({ rows: [], rowCount: 0 });
    const { GET } = await import("@/app/api/diagrams/[id]/export/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams/d1/export", {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(404);
    vi.unstubAllEnvs();
  });

  it("returns 200 with id/title/code when diagram exists (svg may be null)", async () => {
    vi.stubEnv("AI_API_SECRET", SECRET);
    vi.resetModules();
    q.mockResolvedValue({
      rows: [{
        id: "d1",
        code: "sequenceDiagram\nA->>B: hi",
        title: "Test Export",
        diagram_type: "sequence",
      }],
      rowCount: 1,
    });
    const { GET } = await import("@/app/api/diagrams/[id]/export/route");
    const req = new NextRequest("http://localhost:3002/api/diagrams/d1/export", {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("d1");
    expect(body.title).toBe("Test Export");
    expect(body.code).toBe("sequenceDiagram\nA->>B: hi");
    // svg may be null since mermaid.ink is unreachable in tests
    vi.unstubAllEnvs();
  });
});
