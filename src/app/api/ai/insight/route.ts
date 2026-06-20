// API route: POST /api/ai/insight  → { insight: WeeklyInsight }
// Ambil ringkasan nutrisi 7 hari user dari Supabase, kirim ke LLM (arkoda),
// balas insight mingguan. ⚠️ Server-side only — API key di .env server.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { weeklyInsight } from "@/lib/llm";
import type {
  WeeklyInsightInput,
  DailyNutritionSummary,
  DailyWaterSummary,
} from "@/types/database";

// Butuh auth + secret → selalu dinamis, jangan di-prerender saat build.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Format Date → "yyyy-MM-dd" (tanpa dependensi, hindari pergeseran TZ ke UTC).
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export async function POST() {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  // 2. Rentang 7 hari (termasuk hari ini)
  const now = new Date();
  const today = ymd(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  const startDate = ymd(start);

  // 3. Ambil data: nutrisi, air, target, berat
  const [
    { data: nutrition7d },
    { data: water7d },
    { data: goals },
    { data: weights },
  ] = await Promise.all([
    supabase
      .from("daily_nutrition_summary")
      .select("*")
      .eq("user_id", userId)
      .gte("log_date", startDate)
      .lte("log_date", today)
      .order("log_date", { ascending: true }),
    supabase
      .from("daily_water_summary")
      .select("*")
      .eq("user_id", userId)
      .gte("log_date", startDate)
      .lte("log_date", today)
      .order("log_date", { ascending: true }),
    supabase.from("user_goals").select("*").eq("user_id", userId).single(),
    supabase
      .from("weight_logs")
      .select("weight_kg, log_date")
      .eq("user_id", userId)
      .gte("log_date", startDate)
      .lte("log_date", today)
      .order("log_date", { ascending: true }),
  ]);

  const nutri = (nutrition7d ?? []) as DailyNutritionSummary[];
  const water = (water7d ?? []) as DailyWaterSummary[];

  // 4. Cukup data? (butuh minimal 2 hari ada catatan makanan)
  if (nutri.length < 2) {
    return NextResponse.json(
      {
        error:
          "Catatan belum cukup. Catat makanan minimal 2 hari dulu untuk dapat insight mingguan.",
      },
      { status: 422 }
    );
  }

  // 5. Bangun input ringkas untuk LLM (isi 7 hari, hari kosong = 0)
  const days: WeeklyInsightInput["days"] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = ymd(d);
    const n = nutri.find((x) => x.log_date === date);
    const w = water.find((x) => x.log_date === date);
    days.push({
      tanggal: date,
      kalori: Math.round(n?.total_calories ?? 0),
      protein_g: Math.round(Number(n?.total_protein_g ?? 0)),
      karbo_g: Math.round(Number(n?.total_carbs_g ?? 0)),
      lemak_g: Math.round(Number(n?.total_fat_g ?? 0)),
      air_ml: Math.round(w?.total_water_ml ?? 0),
      jumlah_makan: Number(n?.meal_count ?? 0),
    });
  }

  const g = goals as {
    daily_calorie_target?: number;
    daily_protein_g?: number;
    daily_carbs_g?: number;
    daily_fat_g?: number;
    daily_water_ml?: number;
  } | null;

  const input: WeeklyInsightInput = {
    days,
    target: {
      kalori: g?.daily_calorie_target ?? 2000,
      protein_g: g?.daily_protein_g ?? 120,
      karbo_g: g?.daily_carbs_g ?? 250,
      lemak_g: g?.daily_fat_g ?? 65,
      air_ml: g?.daily_water_ml ?? 2000,
    },
    berat:
      weights && weights.length >= 2
        ? {
            awal_kg: Number(weights[0].weight_kg),
            akhir_kg: Number(weights[weights.length - 1].weight_kg),
          }
        : null,
  };

  // 6. Panggil LLM
  try {
    const insight = await weeklyInsight(input);
    return NextResponse.json({ insight });
  } catch (err) {
    console.error("[AI insight error]", err);
    return NextResponse.json(
      { error: "Gagal membuat insight", detail: String(err) },
      { status: 500 }
    );
  }
}
