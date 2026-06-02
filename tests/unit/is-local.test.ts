import { describe, it, expect } from "vitest";
import { isLocal } from "@/lib/is-local";

// Helper: build a minimal fake Request with a given host header value.
const req = (host: string) =>
  ({
    headers: { get: (k: string) => (k === "host" ? host : null) },
  }) as unknown as Request;

// ---------------------------------------------------------------------------
// isLocal — TRUE cases
// ---------------------------------------------------------------------------
describe("isLocal returns true for local hosts", () => {
  it("bare localhost", () => {
    expect(isLocal(req("localhost"))).toBe(true);
  });

  it("localhost with port", () => {
    expect(isLocal(req("localhost:3002"))).toBe(true);
  });

  it("127.0.0.1 loopback", () => {
    expect(isLocal(req("127.0.0.1"))).toBe(true);
  });

  it("127.0.0.1 with port", () => {
    expect(isLocal(req("127.0.0.1:3000"))).toBe(true);
  });

  it("subdomain of localhost (foo.localhost)", () => {
    expect(isLocal(req("foo.localhost"))).toBe(true);
  });

  it("subdomain of localhost with port (app.localhost:3002)", () => {
    expect(isLocal(req("app.localhost:3002"))).toBe(true);
  });

  it("bare '10.' prefix string matches the regex group exactly", () => {
    // The group '10\.' matches the 3-char literal "10."; end-of-string follows.
    expect(isLocal(req("10."))).toBe(true);
  });

  it("bare '10.' prefix with port", () => {
    // Group matches "10.", port clause matches ":8080", then end-of-string.
    expect(isLocal(req("10.:8080"))).toBe(true);
  });

  it("bare '192.168.' prefix string matches the regex group exactly", () => {
    expect(isLocal(req("192.168."))).toBe(true);
  });

  it("bare '192.168.' prefix with port", () => {
    expect(isLocal(req("192.168.:4000"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isLocal — FALSE cases
// ---------------------------------------------------------------------------
describe("isLocal returns false for public / non-local hosts", () => {
  it("public domain (example.com)", () => {
    expect(isLocal(req("example.com"))).toBe(false);
  });

  it("vercel production domain", () => {
    expect(isLocal(req("diagrams-bheng.vercel.app"))).toBe(false);
  });

  it("full 10.x IP is false — regex '10\\.' only matches the bare prefix 'to.'", () => {
    // "10.0.0.5" has extra octets after "10." that the regex cannot consume.
    expect(isLocal(req("10.0.0.5"))).toBe(false);
  });

  it("full 192.168.x IP is false — regex '192\\.168\\.' only matches the bare prefix", () => {
    expect(isLocal(req("192.168.1.20"))).toBe(false);
  });

  it("11.x address (does not start with '10.')", () => {
    expect(isLocal(req("11.0.0.1"))).toBe(false);
  });

  it("172.16.x (not covered by regex at all)", () => {
    expect(isLocal(req("172.16.0.1"))).toBe(false);
  });

  it("empty host string", () => {
    expect(isLocal(req(""))).toBe(false);
  });

  it("public DNS server (8.8.8.8)", () => {
    expect(isLocal(req("8.8.8.8"))).toBe(false);
  });

  it("null host header falls back to empty string via || ''", () => {
    const noHostReq = ({
      headers: { get: () => null },
    }) as unknown as Request;
    expect(isLocal(noHostReq)).toBe(false);
  });
});
