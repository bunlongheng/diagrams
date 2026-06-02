/**
 * Unit tests for lib/auth-owner.ts
 *
 * Tests the real implementation of authorizeOwner, ownerId, and resolveOwnerId.
 * @/auth and @/lib/is-local are mocked so no DB or network is touched.
 *
 * NOTE: lib/auth-owner reads OWNER_EMAIL at MODULE scope, so tests that exercise
 * the email-match path must vi.stubEnv + vi.resetModules + dynamic import.
 * AI_API_SECRET and OWNER_USER_ID are read at call time, so no resetModules needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module-level mocks ────────────────────────────────────────────────────────
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/is-local", () => ({ isLocal: vi.fn() }));

import { auth } from "@/auth";
import { isLocal } from "@/lib/is-local";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockIsLocal = isLocal as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockIsLocal.mockReturnValue(false);
  mockAuth.mockResolvedValue(null);
});

// ─── helpers ─────────────────────────────────────────────────────────────────
function makeReq(options: { authorization?: string; host?: string } = {}): Request {
  const headers: Record<string, string> = {};
  if (options.authorization) headers["authorization"] = options.authorization;
  if (options.host) headers["host"] = options.host;
  return new Request("http://x/test", { headers });
}

// ════════════════════════════════════════════════════════════════════════════
// authorizeOwner
// ════════════════════════════════════════════════════════════════════════════
describe("authorizeOwner", () => {
  it("returns true immediately when isLocal returns true (no auth call needed)", async () => {
    mockIsLocal.mockReturnValue(true);
    // Import directly — OWNER_EMAIL at module scope doesn't affect this path
    const { authorizeOwner } = await import("@/lib/auth-owner");
    const req = makeReq();
    const result = await authorizeOwner(req);
    expect(result).toBe(true);
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("returns true when Bearer matches AI_API_SECRET", async () => {
    vi.stubEnv("AI_API_SECRET", "mysecret");
    mockIsLocal.mockReturnValue(false);
    const { authorizeOwner } = await import("@/lib/auth-owner");
    const req = makeReq({ authorization: "Bearer mysecret" });
    const result = await authorizeOwner(req);
    expect(result).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns false when Bearer is wrong", async () => {
    vi.stubEnv("AI_API_SECRET", "mysecret");
    mockIsLocal.mockReturnValue(false);
    // Need to ensure OWNER_EMAIL is unset so we don't fall through to session check
    vi.stubEnv("OWNER_EMAIL", "");
    vi.stubEnv("ALLOWED_EMAIL", "");
    vi.resetModules();
    const { authorizeOwner } = await import("@/lib/auth-owner");
    const req = makeReq({ authorization: "Bearer wrongtoken" });
    const result = await authorizeOwner(req);
    expect(result).toBe(false);
    vi.unstubAllEnvs();
  });

  it("returns false when not local, no bearer, and OWNER_EMAIL is unset", async () => {
    vi.stubEnv("OWNER_EMAIL", "");
    vi.stubEnv("ALLOWED_EMAIL", "");
    vi.resetModules();
    const { authorizeOwner } = await import("@/lib/auth-owner");
    mockIsLocal.mockReturnValue(false);
    const req = makeReq();
    const result = await authorizeOwner(req);
    expect(result).toBe(false);
    expect(mockAuth).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("returns true when session email matches OWNER_EMAIL", async () => {
    vi.stubEnv("OWNER_EMAIL", "owner@x.com");
    vi.resetModules();
    const { authorizeOwner } = await import("@/lib/auth-owner");
    mockIsLocal.mockReturnValue(false);
    mockAuth.mockResolvedValue({ user: { email: "owner@x.com" } });
    const req = makeReq();
    const result = await authorizeOwner(req);
    expect(result).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns false when session email does not match OWNER_EMAIL", async () => {
    vi.stubEnv("OWNER_EMAIL", "owner@x.com");
    vi.resetModules();
    const { authorizeOwner } = await import("@/lib/auth-owner");
    mockIsLocal.mockReturnValue(false);
    mockAuth.mockResolvedValue({ user: { email: "other@x.com" } });
    const req = makeReq();
    const result = await authorizeOwner(req);
    expect(result).toBe(false);
    vi.unstubAllEnvs();
  });

  it("returns false when auth() returns null (no session)", async () => {
    vi.stubEnv("OWNER_EMAIL", "owner@x.com");
    vi.resetModules();
    const { authorizeOwner } = await import("@/lib/auth-owner");
    mockIsLocal.mockReturnValue(false);
    mockAuth.mockResolvedValue(null);
    const req = makeReq();
    const result = await authorizeOwner(req);
    expect(result).toBe(false);
    vi.unstubAllEnvs();
  });

  it("is case-insensitive for owner email comparison", async () => {
    vi.stubEnv("OWNER_EMAIL", "Owner@X.COM");
    vi.resetModules();
    const { authorizeOwner } = await import("@/lib/auth-owner");
    mockIsLocal.mockReturnValue(false);
    mockAuth.mockResolvedValue({ user: { email: "owner@x.com" } });
    const req = makeReq();
    const result = await authorizeOwner(req);
    expect(result).toBe(true);
    vi.unstubAllEnvs();
  });

  it("falls back to ALLOWED_EMAIL when OWNER_EMAIL is not set", async () => {
    // OWNER_EMAIL must be truly absent (undefined), not empty string,
    // because "" is not nullish so ?? would use "" (falsy) and skip session check.
    const had = "OWNER_EMAIL" in process.env;
    const saved = process.env.OWNER_EMAIL;
    delete process.env.OWNER_EMAIL;
    vi.stubEnv("ALLOWED_EMAIL", "allowed@x.com");
    vi.resetModules();
    const { authorizeOwner } = await import("@/lib/auth-owner");
    mockIsLocal.mockReturnValue(false);
    mockAuth.mockResolvedValue({ user: { email: "allowed@x.com" } });
    const req = makeReq();
    const result = await authorizeOwner(req);
    // restore
    if (had) process.env.OWNER_EMAIL = saved;
    vi.unstubAllEnvs();
    expect(result).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ownerId
// ════════════════════════════════════════════════════════════════════════════
describe("ownerId", () => {
  it("returns OWNER_USER_ID when set", async () => {
    vi.stubEnv("OWNER_USER_ID", "uuid-1234");
    // No resetModules needed - ownerId reads env at call time
    const { ownerId } = await import("@/lib/auth-owner");
    expect(ownerId()).toBe("uuid-1234");
    vi.unstubAllEnvs();
  });

  it("returns null when OWNER_USER_ID is not set", async () => {
    vi.stubEnv("OWNER_USER_ID", "");
    const { ownerId } = await import("@/lib/auth-owner");
    expect(ownerId()).toBeNull();
    vi.unstubAllEnvs();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// resolveOwnerId
// ════════════════════════════════════════════════════════════════════════════
describe("resolveOwnerId", () => {
  it("returns OWNER_USER_ID when authorized (isLocal true)", async () => {
    vi.stubEnv("OWNER_USER_ID", "owner-uuid");
    mockIsLocal.mockReturnValue(true);
    const { resolveOwnerId } = await import("@/lib/auth-owner");
    const req = makeReq();
    const result = await resolveOwnerId(req);
    expect(result).toBe("owner-uuid");
    vi.unstubAllEnvs();
  });

  it("returns null when not authorized (not local, no bearer, no session)", async () => {
    vi.stubEnv("OWNER_EMAIL", "");
    vi.stubEnv("ALLOWED_EMAIL", "");
    vi.stubEnv("OWNER_USER_ID", "owner-uuid");
    vi.resetModules();
    const { resolveOwnerId } = await import("@/lib/auth-owner");
    mockIsLocal.mockReturnValue(false);
    const req = makeReq();
    const result = await resolveOwnerId(req);
    expect(result).toBeNull();
    vi.unstubAllEnvs();
  });

  it("returns null when authorized but OWNER_USER_ID is unset", async () => {
    vi.stubEnv("OWNER_USER_ID", "");
    mockIsLocal.mockReturnValue(true);
    const { resolveOwnerId } = await import("@/lib/auth-owner");
    const req = makeReq();
    const result = await resolveOwnerId(req);
    expect(result).toBeNull();
    vi.unstubAllEnvs();
  });
});
