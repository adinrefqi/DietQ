"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Loader2, ScanLine, Plus, RotateCcw, Search } from "lucide-react";
import type { BarcodeProduct } from "@/types/database";

interface BarcodeScannerProps {
  // Dipanggil saat user menambahkan produk hasil scan ke log.
  onAdd: (food: {
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    serving_size_g: number;
  }) => void;
  submitting: boolean;
}

type Status = "scanning" | "lookup" | "result" | "notfound" | "error";

export function BarcodeScanner({ onAdd, submitting }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledRef = useRef(false); // cegah lookup ganda dari callback beruntun

  const [status, setStatus] = useState<Status>("scanning");
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [grams, setGrams] = useState(100);
  const [errMsg, setErrMsg] = useState<string>("");
  const [manualCode, setManualCode] = useState("");

  // Stop kamera (lepas stream).
  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  // Lookup ke API setelah dapat kode.
  const lookup = useCallback(async (code: string) => {
    stopCamera();
    setStatus("lookup");
    try {
      const res = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal lookup");
      if (!data.found) {
        setStatus("notfound");
        return;
      }
      const p = data.product as BarcodeProduct;
      setProduct(p);
      setGrams(p.serving_size_g ?? 100);
      setStatus("result");
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [stopCamera]);

  // Mulai kamera + decode.
  const startScan = useCallback(async () => {
    handledRef.current = false;
    setStatus("scanning");
    setProduct(null);
    setErrMsg("");
    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result) => {
          if (result && !handledRef.current) {
            handledRef.current = true;
            lookup(result.getText());
          }
        }
      );
      controlsRef.current = controls;
    } catch (err) {
      setErrMsg(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Akses kamera ditolak. Izinkan kamera atau ketik kode manual."
          : "Kamera tidak tersedia. Coba ketik kode barcode manual."
      );
      setStatus("error");
    }
  }, [lookup]);

  // Start saat mount, stop saat unmount.
  useEffect(() => {
    startScan();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManual = () => {
    const code = manualCode.trim();
    if (/^\d{6,14}$/.test(code)) {
      handledRef.current = true;
      lookup(code);
    } else {
      setErrMsg("Kode harus 6–14 digit angka.");
      setStatus("error");
    }
  };

  // Hitung total nutrisi dari per-100g × gram.
  const totals = product
    ? (() => {
        const f = grams / 100;
        return {
          calories: Math.round(product.per100g.calories * f),
          protein_g: Math.round(product.per100g.protein_g * f * 10) / 10,
          carbs_g: Math.round(product.per100g.carbs_g * f * 10) / 10,
          fat_g: Math.round(product.per100g.fat_g * f * 10) / 10,
        };
      })()
    : null;

  return (
    <div className="space-y-3">
      {/* Kamera (saat scanning) */}
      {status === "scanning" && (
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            {/* Garis bidik */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-24 w-4/5 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          </div>
          <p className="flex items-center justify-center gap-2 text-sm text-zinc-500">
            <ScanLine className="h-4 w-4 animate-pulse" />
            Arahkan ke barcode kemasan…
          </p>
        </div>
      )}

      {/* Loading lookup */}
      {status === "lookup" && (
        <div className="flex flex-col items-center gap-2 py-12 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          Mencari produk…
        </div>
      )}

      {/* Hasil ditemukan */}
      {status === "result" && product && totals && (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
          <p className="font-semibold text-zinc-900">{product.name}</p>
          <p className="mb-3 text-xs text-zinc-400">Barcode {product.code}</p>

          {/* Porsi (gram) */}
          <div className="mb-3 flex items-center gap-2">
            <label className="text-sm text-zinc-600">Porsi</label>
            <input
              type="number"
              min={1}
              value={grams}
              onChange={(e) => setGrams(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <span className="text-sm text-zinc-500">gram</span>
          </div>

          <div className="mb-4 grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Kalori", value: `${totals.calories}` },
              { label: "Protein", value: `${totals.protein_g}g` },
              { label: "Karbo", value: `${totals.carbs_g}g` },
              { label: "Lemak", value: `${totals.fat_g}g` },
            ].map((it) => (
              <div key={it.label} className="rounded-lg bg-zinc-50 p-2">
                <p className="text-xs text-zinc-500">{it.label}</p>
                <p className="mt-0.5 font-semibold text-zinc-900">{it.value}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() =>
                onAdd({
                  food_name: product.name,
                  calories: totals.calories,
                  protein_g: totals.protein_g,
                  carbs_g: totals.carbs_g,
                  fat_g: totals.fat_g,
                  serving_size_g: grams,
                })
              }
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              Tambah ke log
            </button>
            <button
              onClick={startScan}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 px-4 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              <RotateCcw className="h-4 w-4" />
              Scan lagi
            </button>
          </div>
        </div>
      )}

      {/* Tidak ditemukan / error → fallback ketik manual */}
      {(status === "notfound" || status === "error") && (
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-700">
            {status === "notfound"
              ? "Produk tidak ditemukan di Open Food Facts (database produk Indonesia masih terbatas). Coba kode lain, atau catat lewat tab Kamera/Cari."
              : errMsg}
          </p>
          {/* Input manual barcode */}
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Ketik nomor barcode…"
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <button
              onClick={handleManual}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              <Search className="h-4 w-4" />
              Cari
            </button>
          </div>
          <button
            onClick={startScan}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-300 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            <RotateCcw className="h-4 w-4" />
            Scan ulang dengan kamera
          </button>
        </div>
      )}
    </div>
  );
}
