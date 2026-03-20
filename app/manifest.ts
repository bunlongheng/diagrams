import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Diagrams",
        short_name: "Diagrams",
        description: "Beautiful diagram generator — paste any diagram syntax and get a polished visual instantly.",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "hsl(285,90%,52%)",
        icons: [
            { src: "/icon.svg",    sizes: "any",        type: "image/svg+xml", purpose: "any" },
            { src: "/icon",        sizes: "32x32",      type: "image/png" },
            { src: "/apple-icon",  sizes: "180x180",    type: "image/png" },
            { src: "/icon-192",    sizes: "192x192",    type: "image/png" },
            { src: "/icon-512",    sizes: "512x512",    type: "image/png", purpose: "maskable" },
        ],
    };
}
