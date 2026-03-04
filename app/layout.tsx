import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "hsl(285,90%,52%)",
};

export const metadata: Metadata = {
  title: "Mermaid++",
  description: "Beautiful sequence diagram generator — paste any mermaid sequence syntax and get a polished visual instantly.",
  metadataBase: new URL("https://mermaid-bheng.vercel.app"),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mermaid++",
  },
  openGraph: {
    title: "Mermaid++ — Sequence Diagram Generator",
    description: "Paste mermaid syntax, get beautiful sequence diagrams instantly.",
    type: "website",
    url: "https://mermaid-bheng.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mermaid++ — Sequence Diagram Generator",
    description: "Paste mermaid syntax, get beautiful sequence diagrams instantly.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
