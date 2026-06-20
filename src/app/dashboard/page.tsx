// Dashboard — halaman utama setelah login
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { format, subDays } from "date-fns";
import type { DailyNutritionSummary, DailyWaterSummary, Profile } from "@/types/database";
import { DashboardClient } from "./client";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const userId = user.id;
  const today = format(new Date(), "yyyy-MM-dd");
  const sevenDaysAgo = format(subDays(new Date(), 6), "yyyy-MM-dd");

  // Fetch profile + goals
  const [{ data: profile }, { data: goals }, { data: nutrition7d }, { data: water7d }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("user_goals").select("*").eq("user_id", userId).single(),
      supabase
        .from("daily_nutrition_summary")
        .select("*")
        .eq("user_id", userId)
        .gte("log_date", sevenDaysAgo)
        .lte("log_date", today)
        .order("log_date", { ascending: true }),
      supabase
        .from("daily_water_summary")
        .select("*")
        .eq("user_id", userId)
        .gte("log_date", sevenDaysAgo)
        .lte("log_date", today)
        .order("log_date", { ascending: true }),
    ]);

  // Merge days — fill gaps dengan default
  const days: Array<{ date: string; nutrition: DailyNutritionSummary | null; water: DailyWaterSummary | null }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    const n = nutrition7d?.find((x) => x.log_date === d) ?? null;
    const w = water7d?.find((x) => x.log_date === d) ?? null;
    days.push({ date: d, nutrition: n as DailyNutritionSummary | null, water: w as DailyWaterSummary | null });
  }

  return (
    <DashboardClient
      profile={profile as Profile | null}
      goals={goals}
      days={days}
      today={today}
    />
  );
}
