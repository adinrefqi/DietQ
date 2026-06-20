"use client";

import { useEffect } from "react";

// Mendaftarkan service worker setelah halaman dimuat.
// Komponen kecil tanpa UI — cukup ditaruh sekali di root layout.
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("[PWA] Gagal register service worker:", err);
      });
    };

    // Daftarkan setelah load agar tidak bersaing dgn resource awal
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
