/**
 * Component tests for CuteToast, SignInButton (LoginForm), MermaidRenderer, DiagramsShell
 */
import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/msw/server";

// ---------------------------------------------------------------------------
// Mock declarations (must be at top level for vi.mock hoisting)
// ---------------------------------------------------------------------------

// Mock next-auth/react - single source of truth for auth in this app
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  getSession: vi.fn(),
}));

// Mock mermaid - before MermaidRenderer import
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(),
  },
}));

// Mock DiagramsClient to avoid rendering the heavy component
vi.mock("@/app/DiagramsClient", () => ({
  default: () => <div>CLIENT_STUB</div>,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are declared)
// ---------------------------------------------------------------------------
import { CuteToast, showToast } from "@/app/CuteToast";
import LoginForm from "@/app/SignInButton";
import MermaidRenderer from "@/app/MermaidRenderer";
import DiagramsShell from "@/app/DiagramsShell";
import { signIn, getSession } from "next-auth/react";
import mermaid from "mermaid";

const mockSignIn = vi.mocked(signIn);
const mockGetSession = vi.mocked(getSession);
const mockMermaid = vi.mocked(mermaid);

// ---------------------------------------------------------------------------
// 1) CuteToast tests
// ---------------------------------------------------------------------------
describe("CuteToast", () => {
  it("renders nothing initially (container is empty)", () => {
    const { container } = render(<CuteToast />);
    // When no toast, CuteToast returns null — nothing in container
    expect(container.firstChild).toBeNull();
  });

  it("shows message text after showToast()", async () => {
    render(<CuteToast />);
    act(() => showToast("Saved!"));
    // CSS text-transform:uppercase is visual only — DOM text is original case
    await waitFor(() => expect(screen.getByText("Saved!")).toBeInTheDocument());
  });

  it("applies custom background color to pill element", async () => {
    render(<CuteToast />);
    act(() => showToast("Hi", { color: "#ff0000" }));
    await waitFor(() => {
      // The inner pill div has background: toast.color
      const msgEl = screen.getByText("Hi");
      // Walk up to the pill div (parent of the span with text)
      const pill = msgEl.closest("div[style*='border-radius: 999']") as HTMLElement | null;
      expect(pill).not.toBeNull();
      expect(pill!.style.background).toBe("rgb(255, 0, 0)");
    });
  });

  it("renders confetti particle divs when confetti: true", async () => {
    // Use a single CuteToast instance; the global listeners set means only one
    // instance should exist per test anyway.
    const { container } = render(<CuteToast />);

    // Show no-confetti toast first, record div count
    act(() => showToast("NoConfetti", { color: "#6366f1", confetti: false }));
    await waitFor(() => expect(screen.getByText("NoConfetti")).toBeInTheDocument());
    const noConfettiCount = container.querySelectorAll("div").length;

    // Now show confetti toast and record div count
    act(() => showToast("Party", { color: "#6366f1", confetti: true }));
    await waitFor(() => expect(screen.getByText("Party")).toBeInTheDocument());
    const confettiCount = container.querySelectorAll("div").length;

    // 18 confetti particle divs are added
    expect(confettiCount).toBeGreaterThan(noConfettiCount);
    expect(confettiCount - noConfettiCount).toBe(18);
  });

  it("removes toast after 5000ms with fake timers", async () => {
    vi.useFakeTimers();
    try {
      render(<CuteToast />);
      act(() => showToast("Timed"));
      // Flush state
      await act(async () => {});
      expect(screen.getByText("Timed")).toBeInTheDocument();

      // Advance time past the 5s dismiss
      act(() => vi.advanceTimersByTime(5100));
      await act(async () => {});
      expect(screen.queryByText("Timed")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("calling showToast twice shows only the latest message", async () => {
    render(<CuteToast />);
    act(() => showToast("First"));
    act(() => showToast("Second"));
    await waitFor(() => {
      expect(screen.getByText("Second")).toBeInTheDocument();
      // "First" should not be visible (overwritten by state update)
      expect(screen.queryByText("First")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 2) SignInButton (LoginForm) tests
// ---------------------------------------------------------------------------
describe("LoginForm (SignInButton)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders a button with text 'Continue with Google'", () => {
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });

  it("calls signIn with 'google' and callbackUrl '/' on click", async () => {
    mockSignIn.mockResolvedValue(undefined as any);
    render(<LoginForm />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    });
    expect(mockSignIn).toHaveBeenCalledWith("google", { callbackUrl: "/" });
  });

  it("button is disabled while loading (after click)", async () => {
    // signIn never resolves so loading stays true
    mockSignIn.mockReturnValue(new Promise(() => {}));
    render(<LoginForm />);
    const btn = screen.getByRole("button", { name: /continue with google/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn).toBeDisabled();
    });
  });
});

// ---------------------------------------------------------------------------
// 3) MermaidRenderer tests
// ---------------------------------------------------------------------------
describe("MermaidRenderer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders svg in container when mermaid.render resolves", async () => {
    mockMermaid.render.mockResolvedValue({ svg: "<svg data-test='ok'></svg>" } as any);
    const { container } = render(<MermaidRenderer code="graph TD; A-->B" />);
    await waitFor(() => {
      expect(container.querySelector("[data-test='ok']")).toBeInTheDocument();
    });
    expect(mockMermaid.render).toHaveBeenCalled();
  });

  it("does NOT call mermaid.render for empty/whitespace code", async () => {
    render(<MermaidRenderer code="   " />);
    // Give it a tick to settle
    await act(async () => {});
    expect(mockMermaid.render).not.toHaveBeenCalled();
  });

  it("still renders a container div for empty code", () => {
    const { container } = render(<MermaidRenderer code="" />);
    expect(container.querySelector("div")).toBeInTheDocument();
  });

  it("shows error message when mermaid.render rejects", async () => {
    mockMermaid.render.mockRejectedValue(new Error("boom"));
    render(<MermaidRenderer code="graph TD; A-->B" />);
    await waitFor(() => {
      expect(screen.getByText("boom")).toBeInTheDocument();
    });
  });

  it("passes dark prop and still renders (initialize called with theme vars)", async () => {
    mockMermaid.render.mockResolvedValue({ svg: "<svg></svg>" } as any);
    render(<MermaidRenderer code="graph TD; A-->B" dark={true} />);
    await waitFor(() => {
      expect(mockMermaid.initialize).toHaveBeenCalled();
      expect(mockMermaid.render).toHaveBeenCalled();
    });
    // No throw, initialize called with themeVariables containing dark colors
    const initCall = mockMermaid.initialize.mock.calls[0][0] as any;
    expect(initCall.themeVariables).toBeDefined();
    expect(initCall.themeVariables.primaryColor).toBe("#2a2d3a");
  });
});

// ---------------------------------------------------------------------------
// 4) DiagramsShell tests
// ---------------------------------------------------------------------------
describe("DiagramsShell", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state before fetch resolves", async () => {
    // Block the fetch indefinitely
    server.use(
      http.get("*/api/diagrams", () => new Promise(() => {}))
    );
    render(<DiagramsShell />);
    expect(screen.getByText("Loading diagrams…")).toBeInTheDocument();
  });

  it("shows login screen when /api/diagrams returns 401", async () => {
    server.use(
      http.get("*/api/diagrams", () =>
        new HttpResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
      )
    );
    render(<DiagramsShell />);
    await waitFor(() => {
      expect(
        screen.getByText(/sign in to view your saved diagrams/i)
      ).toBeInTheDocument();
    });
  });

  it("shows 'Continue with Google' button when unauthorized", async () => {
    server.use(
      http.get("*/api/diagrams", () =>
        new HttpResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
      )
    );
    render(<DiagramsShell />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /continue with google/i })
      ).toBeInTheDocument();
    });
  });

  it("renders DiagramsClient when authorized with a real session", async () => {
    server.use(
      http.get("*/api/diagrams", () => HttpResponse.json([]))
    );
    mockGetSession.mockResolvedValue({
      user: { email: "a@b.com", name: "A", image: null },
    } as any);
    render(<DiagramsShell />);
    await waitFor(() => {
      expect(screen.getByText("CLIENT_STUB")).toBeInTheDocument();
    });
  });

  it("renders DiagramsClient when authorized but getSession returns null (local bypass)", async () => {
    server.use(
      http.get("*/api/diagrams", () => HttpResponse.json([]))
    );
    mockGetSession.mockResolvedValue(null);
    render(<DiagramsShell />);
    await waitFor(() => {
      expect(screen.getByText("CLIENT_STUB")).toBeInTheDocument();
    });
  });

  it("does not show login screen when authorized (no false positive)", async () => {
    server.use(
      http.get("*/api/diagrams", () => HttpResponse.json([]))
    );
    mockGetSession.mockResolvedValue({
      user: { email: "a@b.com", name: "A", image: null },
    } as any);
    render(<DiagramsShell />);
    await waitFor(() => {
      expect(screen.getByText("CLIENT_STUB")).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/sign in to view your saved diagrams/i)
    ).not.toBeInTheDocument();
  });

  it("shows login screen when fetch throws (network error)", async () => {
    server.use(
      http.get("*/api/diagrams", () => HttpResponse.error())
    );
    render(<DiagramsShell />);
    await waitFor(() => {
      expect(
        screen.getByText(/sign in to view your saved diagrams/i)
      ).toBeInTheDocument();
    });
  });
});
