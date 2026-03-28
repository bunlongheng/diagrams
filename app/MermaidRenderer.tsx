"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  code: string;
  theme?: "default" | "dark" | "neutral" | "forest";
}

let _mermaidReady = false;

export default function MermaidRenderer({ code, theme = "default" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code.trim() || !ref.current) return;
    let cancelled = false;

    async function render() {
      const mermaid = (await import("mermaid")).default;
      if (!_mermaidReady) {
        mermaid.initialize({ startOnLoad: false, theme, securityLevel: "loose", fontFamily: "Inter, system-ui, sans-serif" });
        _mermaidReady = true;
      }
      try {
        const id = `mm-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          // Make svg responsive
          const svgEl = ref.current.querySelector("svg");
          if (svgEl) {
            svgEl.removeAttribute("width");
            svgEl.removeAttribute("height");
            svgEl.style.width = "100%";
            svgEl.style.height = "100%";
            svgEl.style.maxWidth = "100%";
          }
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Render error");
      }
    }

    render();
    return () => { cancelled = true; };
  }, [code, theme]);

  if (error) return (
    <div style={{ padding: 24, color: "#ef4444", fontSize: 13, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
      {error}
    </div>
  );

  return <div ref={ref} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }} />;
}
