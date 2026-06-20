// Types untuk database DietQ — mirror dari supabase-schema.sql

export type Gender = "male" | "female" | "other";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type InputMethod = "manual" | "ai_vision" | "quick_add";
export type FoodCategory =
  | "nasi"
  | "roti"
  | "mie"
  | "sayur"
  | "buah"
  | "daging"
  | "ikan"
  | "telur"
  | "susu"
  | "kacang"
  | "minuman"
  | "snack"
  | "makanan_berat"
  | "bumbu"
  | "lain";
export type CalorieCalcMethod = "manual" | "bmr_tdee" | "goal_weight";

// ── Tables ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  gender: Gender | null;
  birth_date: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  activity_level: ActivityLevel;
  created_at: string;
  updated_at: string;
}

export interface UserGoals {
  id: string;
  user_id: string;
  daily_calorie_target: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
  daily_water_ml: number;
  target_weight_kg: number | null;
  calorie_calc_method: CalorieCalcMethod;
  created_at: string;
  updated_at: string;
}

// Minimal food item untuk UI (list view — tidak perlu semua field DB)
export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory | null;
  serving_size_g: number;
  serving_size_text: string | null;
  calories_per_serving: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface FoodLog {
  id: string;
  user_id: string;
  log_date: string;
  meal_type: MealType | null;
  meal_time: string | null;
  input_method: InputMethod;
  food_id: string | null;
  food_name: string;
  serving_size_g: number | null;
  serving_text: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ai_confidence: number | null;
  ai_raw_response: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeightLog {
  id: string;
  user_id: string;
  weight_kg: number;
  log_date: string;
  notes: string | null;
  created_at: string;
}

export interface WaterLog {
  id: string;
  user_id: string;
  amount_ml: number;
  log_date: string;
  logged_at: string;
}

// ── Views ──────────────────────────────────────────────────────────────────

export interface DailyNutritionSummary {
  user_id: string;
  log_date: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  meal_count: number;
}

export interface DailyWaterSummary {
  user_id: string;
  log_date: string;
  total_water_ml: number;
}

export interface WeightProgress {
  user_id: string;
  height_cm: number | null;
  log_date: string;
  weight_kg: number;
  bmi: number | null;
}

// ── AI Vision Response ─────────────────────────────────────────────────────

export interface NutritionEstimation {
  makanan: string;
  perkiraan_gram: number;
  kalori: number;
  protein_g: number;
  karbohidrat_g: number;
  lemak_g: number;
  kategori: string;
}

// ── Dashboard aggregations ─────────────────────────────────────────────────

export interface DashboardDay {
  date: string;
  nutrition: DailyNutritionSummary;
  water: DailyWaterSummary;
}
