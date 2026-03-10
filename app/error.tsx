"use client";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error("Page error:", error);
    }, [error]);

    return (
        <div style={{ padding: 40, fontFamily: "monospace" }}>
            <h2 style={{ color: "red", marginBottom: 12 }}>Runtime Error</h2>
            <pre style={{ background: "#1a1a1a", color: "#f8f8f8", padding: 20, borderRadius: 8, whiteSpace: "pre-wrap", fontSize: 13 }}>
                {error.message}
                {"\n\n"}
                {error.stack}
            </pre>
            <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}>Try again</button>
        </div>
    );
}
