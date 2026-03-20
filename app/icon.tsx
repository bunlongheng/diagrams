import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
    return new ImageResponse(
        (
            <div style={{
                background: "linear-gradient(135deg, #1e0a3c 0%, #4c1d95 100%)",
                width: "100%",
                height: "100%",
                borderRadius: "22%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "3px",
                padding: "4px",
            }}>
                {/* Two colorful participant boxes */}
                <div style={{ display: "flex", gap: "7px" }}>
                    <div style={{ width: 9, height: 7, background: "#fb7185", borderRadius: 2 }} />
                    <div style={{ width: 9, height: 7, background: "#34d399", borderRadius: 2 }} />
                </div>
                {/* Forward arrow — yellow/amber */}
                <div style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ width: 17, height: 2, background: "#fbbf24" }} />
                    <div style={{ width: 0, height: 0, borderTop: "3px solid transparent", borderBottom: "3px solid transparent", borderLeft: "4px solid #fbbf24" }} />
                </div>
                {/* Return arrow — violet */}
                <div style={{ display: "flex", alignItems: "center", flexDirection: "row-reverse" }}>
                    <div style={{ width: 17, height: 2, background: "#a78bfa" }} />
                    <div style={{ width: 0, height: 0, borderTop: "3px solid transparent", borderBottom: "3px solid transparent", borderRight: "4px solid #a78bfa" }} />
                </div>
            </div>
        ),
        { ...size }
    );
}
