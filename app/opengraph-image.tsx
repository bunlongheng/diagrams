import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
    return new ImageResponse(
        (
            <div style={{ width: 1200, height: 630, background: "#0f0a1e", display: "flex", alignItems: "center", justifyContent: "center", gap: 80, padding: "60px 80px" }}>
                {/* Icon */}
                <div style={{ width: 200, height: 200, background: "linear-gradient(135deg,#0f051e,#2e0f6b)", borderRadius: 45, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 28, flexShrink: 0 }}>
                    <div style={{ display: "flex", gap: 18 }}>
                        <div style={{ width: 50, height: 28, background: "#fb7185", borderRadius: 7 }} />
                        <div style={{ width: 50, height: 28, background: "#a78bfa", borderRadius: 7 }} />
                        <div style={{ width: 50, height: 28, background: "#34d399", borderRadius: 7 }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <div style={{ width: 120, height: 5, background: "#fbbf24" }} />
                        <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "9px solid #fbbf24" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", flexDirection: "row-reverse" }}>
                        <div style={{ width: 120, height: 5, background: "#38bdf8" }} />
                        <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderRight: "9px solid #38bdf8" }} />
                    </div>
                </div>
                {/* Text */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <span style={{ fontSize: 96, fontWeight: 900, color: "white", lineHeight: 1 }}>Diagrams</span>
                    <div style={{ fontSize: 32, color: "rgba(255,255,255,0.65)", fontWeight: 400, lineHeight: 1.4, maxWidth: 580 }}>
                        Beautiful sequence diagrams — paste diagram syntax, get polished visuals instantly.
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
