"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

/**
 * /pdf/[id] — Clean, print-ready view of a diagram.
 * Fetches code from API, renders via Mermaid CDN on a white A4-style page.
 * Users can Cmd+P to print/save as PDF directly from the browser.
 */
export default function PdfPage() {
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/export?id=${id}`)
      .then(async r => {
        if (!r.ok) { setError("Diagram not found"); return; }
        const d = await r.json();
        setTitle(d.title || "Untitled");
        setCode(d.code || "");
      })
      .catch(() => setError("Failed to load diagram"));
  }, [id]);

  // Load Mermaid CDN and render
  useEffect(() => {
    if (!code) return;
    const script = document.createElement("script");
    script.type = "module";
    script.textContent = `
      import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
      mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
      const el = document.getElementById('mermaid-target');
      if (el) {
        const { svg } = await mermaid.render('diagram-svg', el.getAttribute('data-code'));
        el.innerHTML = svg;
        // Scale SVG to fit page width
        const svgEl = el.querySelector('svg');
        if (svgEl) {
          svgEl.style.maxWidth = '100%';
          svgEl.style.height = 'auto';
        }
        document.getElementById('loading')?.remove();
      }
    `;
    document.body.appendChild(script);
    setReady(true);
    return () => { document.body.removeChild(script); };
  }, [code]);

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui", color: "#64748b", fontSize: 16 }}>
        {error}
      </div>
    );
  }

  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          .page { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 48px !important; }
        }
        @page { size: landscape; margin: 0.5in; }
      `}</style>

      {/* Print button — top-right floating */}
      <div className="no-print" style={{
        position: "fixed", top: 16, right: 16, zIndex: 10,
        display: "flex", gap: 8,
      }}>
        <button onClick={() => window.print()} style={{
          padding: "8px 20px", borderRadius: 8, border: "1px solid #e2e8f0",
          background: "#1e293b", color: "#fff", fontSize: 13, fontWeight: 600,
          cursor: "pointer", fontFamily: "system-ui",
        }}>
          Save as PDF
        </button>
        <a href={`/?id=${id}`} style={{
          padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0",
          background: "#fff", color: "#334155", fontSize: 13, fontWeight: 600,
          cursor: "pointer", fontFamily: "system-ui", textDecoration: "none",
          display: "flex", alignItems: "center",
        }}>
          Open in Editor
        </a>
      </div>

      {/* Page */}
      <div style={{
        background: "#f1f5f9", minHeight: "100vh", display: "flex",
        alignItems: "flex-start", justifyContent: "center", padding: "40px 20px",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <div className="page" style={{
          background: "#ffffff", width: "100%", maxWidth: 1100,
          borderRadius: 8, boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          border: "1px solid #e2e8f0", padding: "56px 64px",
        }}>
          {/* Header */}
          <div style={{ marginBottom: 32, borderBottom: "2px solid #e2e8f0", paddingBottom: 20 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", margin: 0, lineHeight: 1.3 }}>
              {title || "Loading..."}
            </h1>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "6px 0 0", fontWeight: 500 }}>
              {dateStr} · diagrams-bheng.vercel.app
            </p>
          </div>

          {/* Diagram */}
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            {!code && <p id="loading" style={{ color: "#94a3b8", fontSize: 14 }}>Loading diagram...</p>}
            <div id="mermaid-target" data-code={code} style={{ width: "100%", overflow: "auto" }} />
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 40, paddingTop: 16, borderTop: "1px solid #e2e8f0",
            display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8",
          }}>
            <span>Generated by Diagrams</span>
            <span>{id}</span>
          </div>
        </div>
      </div>
    </>
  );
}
