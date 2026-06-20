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
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try { msg = JSON.parse(text).error ?? text; } catch {}
        throw new Error(msg);
      }
      setInsight(JSON.parse(text).insight as WeeklyInsight);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (s: number) =>
    s >= 75 ? "text-green-600 dark:text-green-400" : s >= 50 ? "text-amber-500 dark:text-amber-400" : "text-red-500 dark:text-red-400";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4 transition-colors">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Insight AI Mingguan</h1>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {/* Intro / tombol generate */}
        {!insight && (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 p-6 text-center shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">Analisis diet 7 hari terakhir</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              AI merangkum pola makanmu, hal yang sudah baik, dan saran perbaikan.
            </p>
            <button
              onClick={generate}
              disabled={loading}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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
          <div className="rounded-2xl bg-red-50 dark:bg-red-900/30 p-4 text-sm text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800">
            {error}
          </div>
        )}

        {/* Hasil */}
        {insight && (
          <div className="space-y-4">
            {/* Skor + ringkasan */}
            <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className={`text-4xl font-bold ${scoreColor(insight.skor)}`}>
                    {insight.skor}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-600">/ 100</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {insight.ringkasan}
                  </p>
                </div>
              </div>
            </div>

            <InsightList
              title="Yang sudah baik"
              items={insight.hal_baik}
              icon={<ThumbsUp className="h-4 w-4 text-green-600 dark:text-green-400" />}
              accent="bg-green-50 dark:bg-green-900/30"
              dotColor="bg-green-500 dark:bg-green-600"
            />
            <InsightList
              title="Perlu diperbaiki"
              items={insight.perlu_diperbaiki}
              icon={<AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />}
              accent="bg-amber-50 dark:bg-amber-900/30"
              dotColor="bg-amber-500 dark:bg-amber-600"
            />
            <InsightList
              title="Saran"
              items={insight.saran}
              icon={<Lightbulb className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
              accent="bg-violet-50 dark:bg-violet-900/30"
              dotColor="bg-violet-500 dark:bg-violet-600"
            />

            <button
              onClick={generate}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
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
  dotColor,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
  accent: string;
  dotColor: string;
}) {
  if (!items?.length) return null;
  return (
    <div className={`rounded-2xl ${accent} p-5 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors`}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {icon}
        {title}
      </h2>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
