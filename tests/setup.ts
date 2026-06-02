import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./msw/server";

// ── MSW lifecycle ────────────────────────────────────────────────────────────
// "bypass" so the many tests that do no networking aren't forced to register
// handlers; tests that DO assert on outbound HTTP register them with server.use().
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

// ── jsdom shims (jsdom omits these browser APIs) ─────────────────────────────
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
  if (!window.scrollTo) window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  const g = globalThis as unknown as { ResizeObserver?: unknown };
  if (!g.ResizeObserver) g.ResizeObserver = RO;
}
