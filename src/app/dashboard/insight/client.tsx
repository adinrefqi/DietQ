"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ChevronLeft,
  Loader2,
  ThumbsUp,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import type { WeeklyInsight } from "@/types/database";

export function InsightClient() {
  const [insight, setInsight] = useState<WeeklyInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/insight", { method: "POST" });
      // Server bisa balas non-JSON (mis. error infra) → baca text dulu.
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try {
          msg = JSON.parse(text).error ?? text;
        } catch {}
        throw new Error(msg);
      }
      setInsight(JSON.parse(text).insight as WeeklyInsight);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Warna skor: hijau (baik) → kuning → merah
  const scoreColor = (s: number) =>
    s >= 75 ? "text-green-600" : s >= 50 ? "text-amber-500" : "text-red-500";

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-800">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-zinc-900">Insight AI Mingguan</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {/* Intro / tombol generate */}
        {!insight && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-zinc-200">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-white">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="font-semibold text-zinc-900">Analisis diet 7 hari terakhir</p>
            <p className="mt-1 text-sm text-zinc-500">
              AI merangkum pola makanmu, hal yang sudah baik, dan saran perbaikan.
            </p>
            <button
              onClick={generate}
              disabled={loading}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Menganalisis...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Buat Insight
                </>
              )}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        {/* Hasil */}
        {insight && (
          <div className="space-y-4">
            {/* Skor + ringkasan */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className={`text-4xl font-bold ${scoreColor(insight.skor)}`}>
                    {insight.skor}
                  </p>
                  <p className="text-xs text-zinc-400">/ 100</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed text-zinc-700">
                    {insight.ringkasan}
                  </p>
                </div>
              </div>
            </div>

            <InsightList
              title="Yang sudah baik"
              items={insight.hal_baik}
              icon={<ThumbsUp className="h-4 w-4 text-green-600" />}
              accent="bg-green-50"
            />
            <InsightList
              title="Perlu diperbaiki"
              items={insight.perlu_diperbaiki}
              icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
              accent="bg-amber-50"
            />
            <InsightList
              title="Saran"
              items={insight.saran}
              icon={<Lightbulb className="h-4 w-4 text-zinc-700" />}
              accent="bg-zinc-100"
            />

            <button
              onClick={generate}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Buat ulang
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function InsightList({
  title,
  items,
  icon,
  accent,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
  accent: string;
}) {
  if (!items?.length) return null;
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
        {icon}
        {title}
      </h2>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-zinc-700">
            <span
              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${accent} ring-2 ring-inset ring-zinc-300`}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
