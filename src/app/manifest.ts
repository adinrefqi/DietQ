import type { MetadataRoute } from "next";

// Web App Manifest — Next.js otomatis menyajikannya di /manifest.webmanifest
// dan menyuntik <link rel="manifest"> ke <head>.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DietQ — Pantau Nutrisi & Berat Badan",
    short_name: "DietQ",
    description:
      "Catat makanan dengan AI, hitung kalori & makro, lacak air minum dan berat badan.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "id",
    background_color: "#ffffff",
    theme_color: "#059669",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
