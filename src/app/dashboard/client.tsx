"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import {
  Flame,
  Droplets,
  Scale,
  Camera,
  UtensilsCrossed,
  TrendingUp,
  Plus,
  Loader2,
  Sparkles,
  ChevronRight,
  Hourglass,
  History,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  DailyNutritionSummary,
  DailyWaterSummary,
  Profile,
  FastingSession,
} from "@/types/database";

interface DashboardClientProps {
  profile: Profile | null;
  goals: unknown;
  today: string;
  days: Array<{
    date: string;
    nutrition: DailyNutritionSummary | null;
    water: DailyWaterSummary | null;
  }>;
  activeFast: FastingSession | null;
}

function fmtRemain(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}j ${String(m).padStart(2, "0")}m`;
}

export function DashboardClient({
  profile,
  goals,
  days,
  today: todayDate,
  activeFast,
}: DashboardClientProps) {
  const g = goals as {
    daily_calorie_target?: number;
    daily_protein_g?: number;
    daily_carbs_g?: number;
    daily_fat_g?: number;
    daily_water_ml?: number;
  } | null;

  const calTarget = g?.daily_calorie_target ?? 2000;
  const waterTarget = g?.daily_water_ml ?? 2000;

  const today = days[days.length - 1];
  const todayCal = today?.nutrition?.total_calories ?? 0;
  const calPct = Math.min(100, Math.round((todayCal / calTarget) * 100));
  const calLeft = calTarget - todayCal;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!activeFast) return;
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, [activeFast]);

  const fast = activeFast
    ? (() => {
        const startMs = new Date(activeFast.start_at).getTime();
        const targetMs = activeFast.target_hours * 3_600_000;
        const elapsed = nowMs - startMs;
        const remaining = targetMs - elapsed;
        return {
          reached: remaining <= 0,
          remaining,
          pct: Math.min(100, Math.max(0, (elapsed / targetMs) * 100)),
        };
      })()
    : null;

  const supabase = createClient();
  const [water, setWater] = useState<number>(today?.water?.total_water_ml ?? 0);
  const [savingWater, setSavingWater] = useState(false);
  const waterPct = Math.min(100, Math.round((water / waterTarget) * 100));

  async function addWater(ml: number) {
    if (savingWater) return;
    setSavingWater(true);
    const prev = water;
    setWater(prev + ml);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("water_logs").insert({
      user_id: user?.id,
      amount_ml: ml,
      log_date: todayDate,
    });
    if (error) {
      setWater(prev);
      alert(`Gagal menyimpan air: ${error.message}`);
    }
    setSavingWater(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        {/* Quick Stats */}
        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-1">
              <Flame className="h-4 w-4" />
              <span className="text-xs font-medium">Kalori</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{todayCal}</p>
            <div className="mt-2 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-1.5 rounded-full transition-all ${calLeft < 0 ? "bg-red-500" : "bg-orange-500"}`}
                style={{ width: `${calPct}%` }}
              />
            </div>
            <p className={`mt-1 text-xs font-medium ${calLeft < 0 ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
              {calLeft >= 0 ? `Sisa ${calLeft}` : `Lebih ${Math.abs(calLeft)}`}
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">/ {calTarget} kcal</p>
          </div>

          <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-1">
              <Droplets className="h-4 w-4" />
              <span className="text-xs font-medium">Air</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{water}</p>
            <div className="mt-2 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${waterPct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{waterPct}% / {waterTarget} ml</p>
          </div>

          <Link
            href="/dashboard/weight"
            className="rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-1">
              <Scale className="h-4 w-4" />
              <span className="text-xs font-medium">Berat</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {profile?.current_weight_kg ?? "—"}
            </p>
            <div className="mt-3 flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Lihat tren</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">kg</p>
          </Link>
        </section>

        {/* Water Logging */}
        <section className="rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <Droplets className="h-4 w-4 text-blue-500" />
              <h2 className="text-sm font-semibold">Catat Air Minum</h2>
            </div>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {water} / {waterTarget} ml
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "+ Gelas", sub: "250 ml", ml: 250 },
              { label: "+ Botol", sub: "500 ml", ml: 500 },
              { label: "+ Besar", sub: "750 ml", ml: 750 },
            ].map((b) => (
              <button
                key={b.ml}
                onClick={() => addWater(b.ml)}
                disabled={savingWater}
                className="flex flex-col items-center gap-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 py-3 text-zinc-700 dark:text-zinc-300 transition-colors hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50"
              >
                <span className="flex items-center gap-1 text-sm font-semibold">
                  {savingWater ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {b.label}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{b.sub}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/log"
            className="flex items-center gap-3 rounded-2xl bg-zinc-900 dark:bg-emerald-600 px-5 py-4 text-white transition-colors hover:bg-zinc-800 dark:hover:bg-emerald-500"
          >
            <Camera className="h-6 w-6" />
            <div>
              <p className="font-semibold">Catat Makanan</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-200">Foto atau cari manual</p>
            </div>
          </Link>
          <Link
            href="/dashboard/log"
            className="flex items-center gap-3 rounded-2xl bg-white dark:bg-zinc-900 px-5 py-4 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <UtensilsCrossed className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">Cari Makanan</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Database nutrisi</p>
            </div>
          </Link>
        </section>

        {/* AI Insight */}
        <Link
          href="/dashboard/insight"
          className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 text-white transition-opacity hover:opacity-90"
        >
          <Sparkles className="h-6 w-6" />
          <div className="flex-1">
            <p className="font-semibold">Insight AI Mingguan</p>
            <p className="text-xs text-white/80">Analisis pola dietmu 7 hari terakhir</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/80" />
        </Link>

        {/* Fasting */}
        {fast ? (
          <Link
            href="/dashboard/fasting"
            className={`block rounded-2xl px-5 py-4 text-white transition-opacity hover:opacity-90 ${
              fast.reached
                ? "bg-gradient-to-r from-green-600 to-emerald-600"
                : "bg-gradient-to-r from-indigo-600 to-blue-600"
            }`}
          >
            <div className="flex items-center gap-3">
              <Hourglass className="h-6 w-6" />
              <div className="flex-1">
                <p className="font-semibold">
                  {fast.reached ? "Target puasa tercapai! 🎉" : "Sedang puasa"}
                </p>
                <p className="text-xs text-white/80">
                  {activeFast?.protocol === "custom"
                    ? `${activeFast.target_hours} jam`
                    : activeFast?.protocol}
                  {fast.reached
                    ? " · boleh akhiri kapan saja"
                    : ` · ${fmtRemain(fast.remaining)} lagi`}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-white/80" />
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-white/30">
              <div
                className="h-1.5 rounded-full bg-white transition-all"
                style={{ width: `${fast.pct}%` }}
              />
            </div>
          </Link>
        ) : (
          <Link
            href="/dashboard/fasting"
            className="flex items-center gap-3 rounded-2xl bg-white dark:bg-zinc-900 px-5 py-4 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400">
              <Hourglass className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">Intermittent Fasting</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Timer puasa berjendela (16:8, dll)</p>
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-400 dark:text-zinc-600" />
          </Link>
        )}

        {/* 7 Day Chart */}
        <section className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Kalori 7 Hari Terakhir</h2>
          <div className="flex items-end gap-1.5 h-32">
            {days.map((d) => {
              const cal = d.nutrition?.total_calories ?? 0;
              const height = calTarget > 0 ? Math.max(4, Math.min(100, (cal / calTarget) * 100)) : 4;
              const isToday = d.date === days[days.length - 1].date;
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end" style={{ height: "128px" }}>
                    <div
                      className={`w-full rounded-sm transition-all ${isToday ? "bg-orange-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
                      style={{ height: `${height}%` }}
                      title={`${cal} kcal`}
                    />
                  </div>
                  <span className={`text-xs ${isToday ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-600"}`}>
                    {format(parseISO(d.date), "EEE", { locale: id })}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="relative mt-2 h-0 border-b border-dashed border-zinc-300 dark:border-zinc-700">
            <span className="absolute -top-3 right-0 text-xs text-zinc-400 dark:text-zinc-600">Target: {calTarget} kcal</span>
          </div>
        </section>

        {/* Macros */}
        {today.nutrition && (
          <section className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Makronutrien Hari Ini</h2>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Protein</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {Math.round(today.nutrition.total_protein_g)}g / {g?.daily_protein_g ?? 150}g
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-2 rounded-full bg-blue-500 dark:bg-blue-600 transition-all"
                    style={{
                      width: `${Math.min(100, ((today.nutrition.total_protein_g / (g?.daily_protein_g ?? 150)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Karbohidrat</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {Math.round(today.nutrition.total_carbs_g)}g / {g?.daily_carbs_g ?? 200}g
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-2 rounded-full bg-amber-500 dark:bg-amber-600 transition-all"
                    style={{
                      width: `${Math.min(100, ((today.nutrition.total_carbs_g / (g?.daily_carbs_g ?? 200)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Lemak</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {Math.round(today.nutrition.total_fat_g)}g / {g?.daily_fat_g ?? 65}g
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-2 rounded-full bg-pink-500 dark:bg-pink-600 transition-all"
                    style={{
                      width: `${Math.min(100, ((today.nutrition.total_fat_g / (g?.daily_fat_g ?? 65)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Meal Log */}
        <section className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Log Makanan</h2>
            <Link
              href="/dashboard/history"
              className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              <History className="h-3.5 w-3.5" />
              Riwayat & edit
            </Link>
          </div>
          {today.nutrition && today.nutrition.meal_count > 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {today.nutrition.meal_count} makanan · {today.nutrition.total_calories} kcal
            </p>
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">Belum ada makanan hari ini</p>
              <Link
                href="/dashboard/log"
                className="mt-2 inline-block text-sm font-medium text-zinc-900 dark:text-zinc-100 underline underline-offset-4"
              >
                + Catat makanan
              </Link>
            </div>
          )}
        </section>
    </div>
  );
}
