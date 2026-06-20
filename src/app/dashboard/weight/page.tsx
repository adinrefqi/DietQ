// Halaman catat & tren berat badan
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import type { Profile, WeightLog } from "@/types/database";
import { WeightClient } from "./client";

export default async function WeightPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const userId = user.id;
  const today = format(new Date(), "yyyy-MM-dd");

  const [{ data: profile }, { data: goals }, { data: logs }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("user_goals").select("target_weight_kg").eq("user_id", userId).single(),
    supabase
      .from("weight_logs")
      .select("id, user_id, weight_kg, log_date, notes, created_at")
      .eq("user_id", userId)
      .order("log_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  return (
    <WeightClient
      profile={profile as Profile | null}
      targetWeight={(goals as { target_weight_kg: number | null } | null)?.target_weight_kg ?? null}
      logs={(logs as WeightLog[] | null) ?? []}
      today={today}
    />
  );
}
