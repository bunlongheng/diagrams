import { describe, it, expect } from "vitest";

describe("Smoke tests", () => {
  it("true is true", () => {
    expect(true).toBe(true);
  });

  it("environment is jsdom", () => {
    expect(typeof document).toBe("object");
  });

  it("path alias @ resolves correctly", async () => {
    // Verify the resolve alias works by importing package.json
    const pkg = await import("@/package.json");
    expect(pkg.name).toBe("diagrams");
  });
});
