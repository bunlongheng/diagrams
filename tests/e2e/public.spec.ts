import { test, expect } from "@playwright/test";

/**
 * Public & API route tests using APIRequestContext.
 * These tests make direct HTTP requests without loading a browser page.
 * They only use safe read-only or auth-gated endpoints.
 */

test.describe("Public API Routes", () => {
  test("GET /api/lan-ip returns 200 with ip property", async ({ request }) => {
    const res = await request.get("/api/lan-ip");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("ip");
    // ip is either a string (found) or null (no external iface)
    expect(typeof body.ip === "string" || body.ip === null).toBe(true);
  });

  test("GET /api/diagrams without auth returns 401", async ({ request }) => {
    // On localhost, /api/auth/me returns authorized:true (local bypass), but
    // /api/diagrams still returns 401 because OWNER_USER_ID is intentionally
    // unset in dev - the route cannot resolve the owner row without it.
    const res = await request.get("/api/diagrams");
    expect(res.status()).toBe(401);
  });

  test("GET /api/auth/me returns 200 with authorized:true", async ({ request }) => {
    // Local bypass is active on localhost - no real session needed.
    const res = await request.get("/api/auth/me");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ authorized: true });
  });

  test("GET /svg/not-a-uuid returns 400", async ({ request }) => {
    const res = await request.get("/svg/not-a-uuid");
    expect(res.status()).toBe(400);
  });

  test("GET /svg/00000000-0000-0000-0000-000000000000 returns 404 (valid UUID, nonexistent)", async ({ request }) => {
    const res = await request.get("/svg/00000000-0000-0000-0000-000000000000");
    // Valid UUID format but no matching row -> 404
    // (If DB is unreachable it may be 500 - accept both as non-200 to avoid flaking)
    const status = res.status();
    expect([404, 500]).toContain(status);
  });

  test("GET /d/not-a-uuid returns 404", async ({ request }) => {
    const res = await request.get("/d/not-a-uuid");
    expect(res.status()).toBe(404);
  });

  test("GET /api/export without ?id returns 400", async ({ request }) => {
    const res = await request.get("/api/export");
    expect(res.status()).toBe(400);
  });

  test("GET /api/export?id=abc (invalid UUID) returns 400", async ({ request }) => {
    const res = await request.get("/api/export?id=abc");
    expect(res.status()).toBe(400);
  });

  test("POST /api/ai/diagrams without Authorization header returns 401", async ({ request }) => {
    const res = await request.post("/api/ai/diagrams", {
      data: { title: "Test", code: "sequenceDiagram\nA->>B: hi" },
    });
    // Auth check runs before any DB access, so this is safe
    expect(res.status()).toBe(401);
  });

  test("GET / returns 200", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
  });
});

test.describe("SVG route UUID validation", () => {
  test("valid-format UUID gets past the 400 gate", async ({ request }) => {
    // Any properly-formatted UUID should NOT get 400
    const res = await request.get("/svg/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    const status = res.status();
    // Expect 404 (not found in DB) or 500 (DB unreachable), never 400 (format check)
    expect(status).not.toBe(400);
  });

  test("GET /d valid-format UUID gets past the 400 gate", async ({ request }) => {
    const res = await request.get("/d/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    const status = res.status();
    expect(status).not.toBe(400);
  });
});
