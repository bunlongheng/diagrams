import { ImageResponse } from "next/og";

export const runtime = "edge";

function DiagramIcon({ size }: { size: number }) {
    const s = (n: number) => Math.round(n * size / 512);
    return (
        <div style={{ width: size, height: size, background: "hsl(285,90%,52%)", borderRadius: s(115), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: s(20), padding: s(52) }}>
            <div style={{ display: "flex", gap: s(56) }}>
                <div style={{ width: s(148), height: s(82), background: "white", borderRadius: s(18) }} />
                <div style={{ width: s(148), height: s(82), background: "white", borderRadius: s(18) }} />
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ width: s(200), height: s(14), background: "white" }} />
                <div style={{ width: 0, height: 0, borderTop: `${s(13)}px solid transparent`, borderBottom: `${s(13)}px solid transparent`, borderLeft: `${s(22)}px solid white` }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", flexDirection: "row-reverse" }}>
                <div style={{ width: s(200), height: s(14), background: "rgba(255,255,255,0.65)" }} />
                <div style={{ width: 0, height: 0, borderTop: `${s(13)}px solid transparent`, borderBottom: `${s(13)}px solid transparent`, borderRight: `${s(22)}px solid rgba(255,255,255,0.65)` }} />
            </div>
        </div>
    );
}

export async function GET() {
    return new ImageResponse(<DiagramIcon size={192} />, { width: 192, height: 192 });
}
