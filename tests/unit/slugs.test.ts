import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: { query: vi.fn() },
}));

import db from "@/lib/db";
import { toSlug, uniqueDiagramSlug } from "@/lib/slugs";

// ---------------------------------------------------------------------------
// toSlug
// ---------------------------------------------------------------------------
describe("toSlug", () => {
  it("lowercases a simple title", () => {
    expect(toSlug("Hello World")).toBe("hello-world");
  });

  it("collapses multiple spaces into a single dash", () => {
    expect(toSlug("  Spaces  ")).toBe("spaces");
  });

  it("replaces underscores and symbols with dashes", () => {
    expect(toSlug("Foo_Bar!!Baz")).toBe("foo-bar-baz");
  });

  it("strips leading punctuation", () => {
    expect(toSlug("---hello")).toBe("hello");
  });

  it("strips trailing punctuation", () => {
    expect(toSlug("hello---")).toBe("hello");
  });

  it("strips both leading and trailing punctuation", () => {
    expect(toSlug("...hello...")).toBe("hello");
  });

  it("returns 'untitled' for empty string", () => {
    expect(toSlug("")).toBe("untitled");
  });

  it("returns 'untitled' for all-symbol input", () => {
    expect(toSlug("***")).toBe("untitled");
  });

  it("preserves numbers", () => {
    expect(toSlug("Diagram 42")).toBe("diagram-42");
  });

  it("leaves an already-slug string unchanged", () => {
    expect(toSlug("my-diagram")).toBe("my-diagram");
  });

  it("collapses runs of mixed non-alphanumerics into one dash", () => {
    expect(toSlug("a  __  b")).toBe("a-b");
  });
});

// ---------------------------------------------------------------------------
// uniqueDiagramSlug
// ---------------------------------------------------------------------------
describe("uniqueDiagramSlug", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the base slug when no rows exist", async () => {
    (db.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
    const result = await uniqueDiagramSlug("user-1", "Hello World");
    expect(result).toBe("hello-world");
  });

  it("returns base-2 when only the base slug is taken", async () => {
    (db.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [{ slug: "hello-world" }],
    });
    const result = await uniqueDiagramSlug("user-1", "Hello World");
    expect(result).toBe("hello-world-2");
  });

  it("returns base-3 when base and base-2 are both taken", async () => {
    (db.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [{ slug: "hello-world" }, { slug: "hello-world-2" }],
    });
    const result = await uniqueDiagramSlug("user-1", "Hello World");
    expect(result).toBe("hello-world-3");
  });

  it("returns base when only unrelated slugs exist (no collision with base)", async () => {
    (db.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [{ slug: "hello-world-other" }],
    });
    const result = await uniqueDiagramSlug("user-1", "Hello World");
    expect(result).toBe("hello-world");
  });

  it("skips gaps and finds the first free counter", async () => {
    // base, base-2, base-4 taken — base-3 should be returned
    (db.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [
        { slug: "my-diagram" },
        { slug: "my-diagram-2" },
        { slug: "my-diagram-4" },
      ],
    });
    const result = await uniqueDiagramSlug("user-1", "My Diagram");
    expect(result).toBe("my-diagram-3");
  });

  it("calls db.query with the correct parameters", async () => {
    (db.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
    await uniqueDiagramSlug("user-abc", "Test Title");
    expect(db.query).toHaveBeenCalledWith(
      "SELECT slug FROM diagrams WHERE user_id = $1 AND (slug = $2 OR slug LIKE $3)",
      ["user-abc", "test-title", "test-title-%"],
    );
  });
});
