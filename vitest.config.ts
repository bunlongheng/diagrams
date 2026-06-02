import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary"],
      // Coverage targets the testable units. The two giant client components
      // (page.tsx ~2157 lines, DiagramsClient.tsx ~1224 lines) are exercised by
      // Playwright E2E, not unit coverage, so they are excluded from the v8 denominator.
      include: [
        "lib/**/*.ts",
        "app/api/**/*.ts",
        "app/svg/**/*.ts",
        "app/d/**/*.ts",
        "app/CuteToast.tsx",
        "app/SignInButton.tsx",
        "app/MermaidRenderer.tsx",
        "app/DiagramsShell.tsx",
      ],
      // lib/db.ts is a thin pg Pool; the NextAuth catch-all is a 2-line
      // re-export that pulls the whole next-auth runtime — both excluded.
      exclude: ["**/*.d.ts", "lib/db.ts", "app/api/auth/[...nextauth]/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
