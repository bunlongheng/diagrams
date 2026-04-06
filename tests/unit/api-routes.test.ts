import { describe, it, expect } from "vitest";

describe("API route handlers exist and export correctly", () => {
  it("POST /api/diagrams exports POST handler", async () => {
    const mod = await import("@/app/api/diagrams/route");
    expect(typeof mod.POST).toBe("function");
  });

  it("GET /api/diagrams exports GET handler", async () => {
    const mod = await import("@/app/api/diagrams/route");
    expect(typeof mod.GET).toBe("function");
  });

  it("GET /api/diagrams/[id] exports GET handler", async () => {
    const mod = await import("@/app/api/diagrams/[id]/route");
    expect(typeof mod.GET).toBe("function");
  });

  it("PATCH /api/diagrams/[id] exports PATCH handler", async () => {
    const mod = await import("@/app/api/diagrams/[id]/route");
    expect(typeof mod.PATCH).toBe("function");
  });

  it("DELETE /api/diagrams/[id] exports DELETE handler", async () => {
    const mod = await import("@/app/api/diagrams/[id]/route");
    expect(typeof mod.DELETE).toBe("function");
  });

  it("POST /api/ai/generate exports POST handler", async () => {
    const mod = await import("@/app/api/ai/generate/route");
    expect(typeof mod.POST).toBe("function");
  });

  it("POST /api/share exports POST handler", async () => {
    const mod = await import("@/app/api/share/route");
    expect(typeof mod.POST).toBe("function");
  });
});
