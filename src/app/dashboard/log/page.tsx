// Food Log page — camera + barcode + AI vision + food search
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FoodLogClient } from "./client";

export default async function FoodLogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Initial load: fetch popular foods (top 50 by usage_count)
  // Full search via /api/foods/search endpoint
  const { data: popularFoods } = await supabase
    .from("foods")
    .select("id, name, category, serving_size_g, serving_size_text, calories_per_serving, protein_g, carbs_g, fat_g")
    .is("user_id", null) // Only public foods
    .order("usage_count", { ascending: false })
    .limit(50);

  // Today's logs
  const today = new Date().toISOString().split("T")[0];
  const { data: todayLogs } = await supabase
    .from("food_logs")
    .select("*")
    .eq("user_id", user.id)
    .eq("log_date", today)
    .order("meal_time", { ascending: true });

  return (
    <FoodLogClient
      popularFoods={popularFoods ?? []}
      todayLogs={todayLogs ?? []}
    />
  );
}
