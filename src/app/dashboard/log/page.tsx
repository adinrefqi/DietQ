// Food Log page — camera + search + AI vision recognition
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FoodLogClient } from "./client";

export default async function FoodLogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: foods } = await supabase
    .from("foods")
    .select("id, name, category, serving_size_g, serving_size_text, calories_per_serving, protein_g, carbs_g, fat_g")
    .eq("is_verified", true)
    .order("name");

  const today = new Date().toISOString().split("T")[0];
  const { data: todayLogs } = await supabase
    .from("food_logs")
    .select("*")
    .eq("user_id", user.id)
    .eq("log_date", today)
    .order("meal_time", { ascending: true });

  return (
    <FoodLogClient
      foods={foods ?? []}
      todayLogs={todayLogs ?? []}
    />
  );
}
