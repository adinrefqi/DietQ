// Riwayat catatan makanan per tanggal — dengan edit & hapus.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FoodLog } from "@/types/database";
import { HistoryClient } from "./client";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const today = ymd(new Date());
  const sp = await searchParams;
  // Validasi param tanggal; default hari ini.
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const { data: logs } = await supabase
    .from("food_logs")
    .select("*")
    .eq("user_id", user.id)
    .eq("log_date", date)
    .order("meal_time", { ascending: true });

  return (
    <HistoryClient
      date={date}
      today={today}
      logs={(logs as FoodLog[] | null) ?? []}
    />
  );
}
