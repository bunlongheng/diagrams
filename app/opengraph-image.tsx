import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
    return new ImageResponse(
        (
            <div style={{ width: 1200, height: 630, background: "#0f0a1e", display: "flex", alignItems: "center", justifyContent: "center", gap: 80, padding: "60px 80px" }}>
                {/* Icon */}
                <div style={{ width: 200, height: 200, background: "hsl(285,90%,52%)", borderRadius: 45, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 28, flexShrink: 0 }}>
                    <div style={{ display: "flex", gap: 22 }}>
                        <div style={{ width: 58, height: 32, background: "white", borderRadius: 7 }} />
                        <div style={{ width: 58, height: 32, background: "white", borderRadius: 7 }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <div style={{ width: 78, height: 6, background: "white" }} />
                        <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "9px solid white" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", flexDirection: "row-reverse" }}>
                        <div style={{ width: 78, height: 6, background: "rgba(255,255,255,0.65)" }} />
                        <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderRight: "9px solid rgba(255,255,255,0.65)" }} />
                    </div>
                </div>
                {/* Text */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 88, fontWeight: 900, color: "white", lineHeight: 1 }}>Mermaid</span>
                        <span style={{ fontSize: 88, fontWeight: 900, color: "hsl(285,90%,68%)", lineHeight: 1 }}>++</span>
                    </div>
                    <div style={{ fontSize: 32, color: "rgba(255,255,255,0.65)", fontWeight: 400, lineHeight: 1.4, maxWidth: 580 }}>
                        Beautiful sequence diagrams — paste mermaid syntax, get polished visuals instantly.
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                        {["Sequence", "Flowchart", "ERD", "Gantt", "Export PNG"].map(tag => (
                            <div key={tag} style={{ padding: "8px 20px", background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.5)", borderRadius: 999, color: "hsl(285,90%,75%)", fontSize: 22, fontWeight: 600 }}>{tag}</div>
                        ))}
                    </div>
                </div>
            </div>
        ),
        { ...size }
    );
}
