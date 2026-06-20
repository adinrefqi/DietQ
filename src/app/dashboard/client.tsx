"use client";

import { useState } from "react";
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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DailyNutritionSummary, DailyWaterSummary, Profile } from "@/types/database";

interface DashboardClientProps {
  profile: Profile | null;
  goals: unknown;
  today: string; // tanggal "yyyy-MM-dd" sesuai server, dipakai utk insert air
  days: Array<{
    date: string;
    nutrition: DailyNutritionSummary | null;
    water: DailyWaterSummary | null;
  }>;
}

export function DashboardClient({ profile, goals, days, today: todayDate }: DashboardClientProps) {
  const g = goals as {
    daily_calorie_target?: number;
    daily_protein_g?: number;
    daily_carbs_g?: number;
    daily_fat_g?: number;
    daily_water_ml?: number;
  } | null;

  const calTarget = g?.daily_calorie_target ?? 2000;
  const waterTarget = g?.daily_water_ml ?? 2000;

  // Hari ini
  const today = days[days.length - 1];
  const todayCal = today?.nutrition?.total_calories ?? 0;
  const calPct = Math.min(100, Math.round((todayCal / calTarget) * 100));

  // ── Air minum (interaktif, optimistic) ──
  const supabase = createClient();
  const [water, setWater] = useState<number>(today?.water?.total_water_ml ?? 0);
  const [savingWater, setSavingWater] = useState(false);
  const waterPct = Math.min(100, Math.round((water / waterTarget) * 100));

  async function addWater(ml: number) {
    if (savingWater) return;
    setSavingWater(true);
    const prev = water;
    setWater(prev + ml); // optimistic
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("water_logs").insert({
      user_id: user?.id,
      amount_ml: ml,
      log_date: todayDate,
    });
    if (error) {
      setWater(prev); // revert kalau gagal
      alert(`Gagal menyimpan air: ${error.message}`);
    }
    setSavingWater(false);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-4 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">DietQ</h1>
            <p className="text-sm text-zinc-500">
              {profile?.display_name ?? "User"} · Dashboard
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/profile"
              className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 transition-colors"
            >
              Profil
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        {/* Quick Stats Hari Ini */}
        <section className="grid grid-cols-3 gap-3">
          {/* Kalori */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            <div className="flex items-center gap-2 text-zinc-500 mb-1">
              <Flame className="h-4 w-4" />
              <span className="text-xs font-medium">Kalori</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900">{todayCal}</p>
            <div className="mt-2 h-1.5 rounded-full bg-zinc-100">
              <div
                className="h-1.5 rounded-full bg-orange-500 transition-all"
                style={{ width: `${calPct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-400">{calPct}% / {calTarget} kcal</p>
          </div>

          {/* Air */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            <div className="flex items-center gap-2 text-zinc-500 mb-1">
              <Droplets className="h-4 w-4" />
              <span className="text-xs font-medium">Air</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900">{water}</p>
            <div className="mt-2 h-1.5 rounded-full bg-zinc-100">
              <div
                className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${waterPct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-400">{waterPct}% / {waterTarget} ml</p>
          </div>

          {/* Berat → halaman tren */}
          <Link
            href="/dashboard/weight"
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50"
          >
            <div className="flex items-center gap-2 text-zinc-500 mb-1">
              <Scale className="h-4 w-4" />
              <span className="text-xs font-medium">Berat</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900">
              {profile?.current_weight_kg ?? "—"}
            </p>
            <div className="mt-3 flex items-center gap-1 text-blue-600">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Lihat tren</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">kg</p>
          </Link>
        </section>

        {/* Catat Air Cepat */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-700">
              <Droplets className="h-4 w-4 text-blue-500" />
              <h2 className="text-sm font-semibold">Catat Air Minum</h2>
            </div>
            <span className="text-xs text-zinc-400">
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
                className="flex flex-col items-center gap-0.5 rounded-xl border border-zinc-200 bg-zinc-50 py-3 text-zinc-700 transition-colors hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
              >
                <span className="flex items-center gap-1 text-sm font-semibold">
                  {savingWater ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {b.label}
                </span>
                <span className="text-xs text-zinc-400">{b.sub}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Aksi Cepat */}
        <section className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/log"
            className="flex items-center gap-3 rounded-2xl bg-zinc-900 px-5 py-4 text-white transition-colors hover:bg-zinc-800"
          >
            <Camera className="h-6 w-6" />
            <div>
              <p className="font-semibold">Catat Makanan</p>
              <p className="text-xs text-zinc-400">Foto atau cari manual</p>
            </div>
          </Link>
          <Link
            href="/dashboard/log"
            className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50"
          >
            <UtensilsCrossed className="h-6 w-6 text-zinc-600" />
            <div>
              <p className="font-semibold text-zinc-900">Cari Makanan</p>
              <p className="text-xs text-zinc-500">Database nutrisi</p>
            </div>
          </Link>
        </section>

        {/* Insight AI Mingguan */}
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

        {/* Intermittent Fasting */}
        <Link
          href="/dashboard/fasting"
          className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <Hourglass className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-zinc-900">Intermittent Fasting</p>
            <p className="text-xs text-zinc-500">Timer puasa berjendela (16:8, dll)</p>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-400" />
        </Link>

        {/* Grafik 7 Hari */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">Kalori 7 Hari Terakhir</h2>
          <div className="flex items-end gap-1.5 h-32">
            {days.map((d) => {
              const cal = d.nutrition?.total_calories ?? 0;
              const height = calTarget > 0 ? Math.max(4, Math.min(100, (cal / calTarget) * 100)) : 4;
              const isToday = d.date === days[days.length - 1].date;
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end" style={{ height: "128px" }}>
                    <div
                      className={`w-full rounded-sm transition-all ${isToday ? "bg-orange-500" : "bg-zinc-200"}`}
                      style={{ height: `${height}%` }}
                      title={`${cal} kcal`}
                    />
                  </div>
                  <span className={`text-xs ${isToday ? "font-semibold text-zinc-900" : "text-zinc-400"}`}>
                    {format(parseISO(d.date), "EEE", { locale: id })}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Garis target */}
          <div className="relative mt-2 h-0 border-b border-dashed border-zinc-300">
            <span className="absolute -top-3 right-0 text-xs text-zinc-400">Target: {calTarget} kcal</span>
          </div>
        </section>

        {/* Macro Breakdown */}
        {today.nutrition && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900">Makronutrien Hari Ini</h2>
            <div className="space-y-3">
              {/* Protein */}
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-zinc-700">Protein</span>
                  <span className="text-zinc-500">
                    {Math.round(today.nutrition.total_protein_g)}g / {g?.daily_protein_g ?? 150}g
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all"
                    style={{
                      width: `${Math.min(100, ((today.nutrition.total_protein_g / (g?.daily_protein_g ?? 150)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
              {/* Karbo */}
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-zinc-700">Karbohidrat</span>
                  <span className="text-zinc-500">
                    {Math.round(today.nutrition.total_carbs_g)}g / {g?.daily_carbs_g ?? 200}g
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-amber-500 transition-all"
                    style={{
                      width: `${Math.min(100, ((today.nutrition.total_carbs_g / (g?.daily_carbs_g ?? 200)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
              {/* Lemak */}
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-zinc-700">Lemak</span>
                  <span className="text-zinc-500">
                    {Math.round(today.nutrition.total_fat_g)}g / {g?.daily_fat_g ?? 65}g
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-pink-500 transition-all"
                    style={{
                      width: `${Math.min(100, ((today.nutrition.total_fat_g / (g?.daily_fat_g ?? 65)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Meal Log Summary */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900">Log Makanan</h2>
            <span className="text-xs text-zinc-500">
              {today.nutrition?.meal_count ?? 0} makanan hari ini
            </span>
          </div>
          {today.nutrition && today.nutrition.meal_count > 0 ? (
            <p className="text-sm text-zinc-600">
              {today.nutrition.meal_count} makanan · {today.nutrition.total_calories} kcal
            </p>
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm text-zinc-400">Belum ada makanan hari ini</p>
              <Link
                href="/dashboard/log"
                className="mt-2 inline-block text-sm font-medium text-zinc-900 underline underline-offset-4"
              >
                + Catat makanan
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
