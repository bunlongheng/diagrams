import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// Shared MSW node server for unit/component tests. Lifecycle is wired in
// tests/setup.ts (listen / resetHandlers / close).
export const server = setupServer(...handlers);
