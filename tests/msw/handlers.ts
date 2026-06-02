import { http, HttpResponse } from "msw";

// Default handlers are intentionally empty — individual tests register the
// outbound-HTTP stubs they need with `server.use(...)`. Anything not handled is
// bypassed (see tests/setup.ts onUnhandledRequest: "bypass").
export const handlers = [
  // A harmless default the DiagramsShell component test relies on: the saved
  // diagrams list endpoint. Tests override this with server.use() as needed.
  http.get("*/api/diagrams", () => HttpResponse.json([])),
];
