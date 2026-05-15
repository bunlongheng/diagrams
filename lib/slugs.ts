import db from "./db";

export function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}

// Returns a slug unique to (user_id, slug) within the diagrams table.
// One SQL round-trip instead of N: fetch all existing collisions, pick the first free counter.
export async function uniqueDiagramSlug(userId: string, title: string): Promise<string> {
  const base = toSlug(title);
  const { rows } = await db.query(
    "SELECT slug FROM diagrams WHERE user_id = $1 AND (slug = $2 OR slug LIKE $3)",
    [userId, base, `${base}-%`],
  );
  if (rows.length === 0) return base;
  const taken = new Set(rows.map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
