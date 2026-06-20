// API Route: GET /api/foods/search?q=xxx&category=xxx
// 1. Cari di database lokal (Supabase)
// 2. Jika tidak ada & ada query → coba Open Food Facts & auto-cache
// 3. Cache hasil OFF ke DB untuk下次 lookup lebih cepat

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { FoodItem } from "@/types/database";

export const runtime = "edge"; // Fast, global edge deployment
export const dynamic = "force-dynamic";

// Kategori mapping: OFF categories → DietQ categories
const CATEGORY_MAP: Record<string, string> = {
  "en:beverages": "minuman",
  "en:snacks": "snack",
  "en:dairies": "susu",
  "en:cheeses": "susu",
  "en:yogurts": "susu",
  "en:meats": "daging",
  "en:poultry-meats": "daging",
  "en:fish": "ikan",
  "en:seafood": "ikan",
  "en:fruits": "buah",
  "en:vegetables": "sayur",
  "en:legumes": "kacang",
  "en:nuts": "kacang",
  "en:breads": "roti",
  "en:cereals": "nasi",
  "en:pastas": "mie",
  "en:desserts": "dessert",
  "en:sweets": "dessert",
  "en:chocolates": "dessert",
  "en:confectioneries": "dessert",
  "en:ice-creams": "dessert",
  "en:soups": "sup",
  "en:prepared-meals": "makanan_berat",
  "en:fast-foods": "makanan_berat",
  "en:fried-foods": "makanan_berat",
  "en:condiments": "bumbu",
  "en:sauces": "bumbu",
  "en:spreads": "bumbu",
  "en:eggs": "telur",
  "en:egg-based-foods": "telur",
  "en:plant-based-foods": "sayur",
  "en:meat-substitutes": "kacang",
  "en:tofu": "sayur",
  "en:fermented-foods": "lain",
  "en:indonesian-foods": "makanan_berat",
  "en:indonesian-snacks": "snack",
};

function mapCategory(offCategories: string[]): string {
  for (const cat of offCategories) {
    const mapped = CATEGORY_MAP[cat];
    if (mapped) return mapped;
    // Fallback: check if category string contains keywords
    const lower = cat.toLowerCase();
    if (lower.includes("minuman") || lower.includes("beverage") || lower.includes("drink")) return "minuman";
    if (lower.includes("snack")) return "snack";
    if (lower.includes("daging") || lower.includes("meat") || lower.includes("ayam") || lower.includes("sapi")) return "daging";
    if (lower.includes("ikan") || lower.includes("fish") || lower.includes("seafood")) return "ikan";
    if (lower.includes("buah") || lower.includes("fruit")) return "buah";
    if (lower.includes("sayur") || lower.includes("vegetable")) return "sayur";
    if (lower.includes("kacang") || lower.includes("nut") || lower.includes("tahu") || lower.includes("tempe")) return "kacang";
    if (lower.includes("roti") || lower.includes("bread")) return "roti";
    if (lower.includes("nasi") || lower.includes("rice") || lower.includes("cereal")) return "nasi";
    if (lower.includes("mie") || lower.includes("noodle") || lower.includes("pasta")) return "mie";
    if (lower.includes("dessert") || lower.includes("sweet") || lower.includes("candy")) return "dessert";
    if (lower.includes("sup") || lower.includes("soup")) return "sup";
    if (lower.includes("instant") || lower.includes("makanan") || lower.includes("meal")) return "makanan_berat";
    if (lower.includes("bumbu") || lower.includes("sauce") || lower.includes("condiment")) return "bumbu";
    if (lower.includes("telur") || lower.includes("egg")) return "telur";
  }
  return "lain";
}

function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

interface OFFProduct {
  code: string;
  product_name?: string;
  brands?: string;
  categories_tags?: string[];
  serving_size?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
}

interface SearchResult {
  id: string;
  name: string;
  category: string | null;
  serving_size_g: number;
  serving_size_text: string | null;
  calories_per_serving: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: string;
  is_user_food: boolean;
  is_verified: boolean;
}

// Search local DB
async function searchLocal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string,
  category: string | null,
  userId: string | null,
  limit: number
): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc("search_foods", {
    p_query: query || null,
    p_user_id: userId || null,
    p_category: category || null,
    p_limit: limit,
  });

  if (error) {
    console.error("[search_foods rpc error]", error);
    return [];
  }

  return (data ?? []) as SearchResult[];
}

// Search Open Food Facts
async function searchOFF(
  query: string,
  limit: number
): Promise<Array<{
  code: string;
  name: string;
  category: string;
  serving_size_g: number;
  serving_size_text: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}>> {
  try {
    // OFF Search API
    const searchUrl = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    searchUrl.searchParams.set("search_terms", query);
    searchUrl.searchParams.set("search_simple", "1");
    searchUrl.searchParams.set("action", "process");
    searchUrl.searchParams.set("json", "1");
    searchUrl.searchParams.set("page_size", String(limit));
    searchUrl.searchParams.set("fields", "code,product_name,brands,categories_tags,serving_size,nutriments");

    const res = await fetch(searchUrl.toString(), {
      headers: {
        "User-Agent": "DietQ/1.0 (https://dietq.app)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`[OFF search error] ${res.status}`);
      return [];
    }

    const data = await res.json();
    const products: OFFProduct[] = data.products ?? [];

    return products
      .filter((p) => p.code && p.product_name && num(p.nutriments?.["energy-kcal_100g"]) > 0)
      .slice(0, limit)
      .map((p) => {
        const brand = p.brands?.split(",")[0]?.trim() || "";
        const name = p.product_name || "Unknown";
        const fullName = brand && !name.toLowerCase().includes(brand.toLowerCase())
          ? `${name} (${brand})`
          : name;

        // Parse serving size
        const servingStr = p.serving_size || "100g";
        const servingMatch = servingStr.match(/([\d.,]+)\s*(g|gr|gram|ml)?/i);
        const servingSize = servingMatch ? Math.round(parseFloat(servingMatch[1].replace(",", "."))) || 100 : 100;

        return {
          code: p.code,
          name: fullName,
          category: mapCategory(p.categories_tags ?? []),
          serving_size_g: servingSize,
          serving_size_text: servingStr,
          calories: num(p.nutriments?.["energy-kcal_100g"]) * (servingSize / 100),
          protein: num(p.nutriments?.proteins_100g) * (servingSize / 100),
          carbs: num(p.nutriments?.carbohydrates_100g) * (servingSize / 100),
          fat: num(p.nutriments?.fat_100g) * (servingSize / 100),
        };
      });
  } catch (err) {
    console.error("[OFF search error]", err);
    return [];
  }
}

// Cache OFF product to DB
async function cacheOFFProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  product: {
    code: string;
    name: string;
    category: string;
    serving_size_g: number;
    serving_size_text: string | null;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }
): Promise<string | null> {
  const { data, error } = await supabase.rpc("cache_off_food", {
    p_code: product.code,
    p_name: product.name,
    p_category: product.category,
    p_serving_g: product.serving_size_g,
    p_calories: product.calories,
    p_protein: product.protein,
    p_carbs: product.carbs,
    p_fat: product.fat,
    p_serving_text: product.serving_size_text,
  });

  if (error) {
    console.error("[cache_off_food error]", error);
    return null;
  }

  return data as string;
}

// Lookup single OFF product by barcode
async function lookupOFF(barcode: string): Promise<{
  code: string;
  name: string;
  category: string;
  serving_size_g: number;
  serving_size_text: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} | null> {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,brands,categories_tags,serving_size,nutriments`;

    const res = await fetch(url, {
      headers: { "User-Agent": "DietQ/1.0 (https://dietq.app)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok || res.status === 404) return null;

    const data = await res.json();
    const p: OFFProduct = data.product;

    if (!p?.code || !p?.product_name || num(p.nutriments?.["energy-kcal_100g"]) === 0) {
      return null;
    }

    const brand = p.brands?.split(",")[0]?.trim() || "";
    const name = p.product_name || "Unknown";
    const fullName = brand && !name.toLowerCase().includes(brand.toLowerCase())
      ? `${name} (${brand})`
      : name;

    const servingStr = p.serving_size || "100g";
    const servingMatch = servingStr.match(/([\d.,]+)\s*(g|gr|gram|ml)?/i);
    const servingSize = servingMatch ? Math.round(parseFloat(servingMatch[1].replace(",", "."))) || 100 : 100;

    return {
      code: p.code,
      name: fullName,
      category: mapCategory(p.categories_tags ?? []),
      serving_size_g: servingSize,
      serving_size_text: servingStr,
      calories: num(p.nutriments?.["energy-kcal_100g"]) * (servingSize / 100),
      protein: num(p.nutriments?.proteins_100g) * (servingSize / 100),
      carbs: num(p.nutriments?.carbohydrates_100g) * (servingSize / 100),
      fat: num(p.nutriments?.fat_100g) * (servingSize / 100),
    };
  } catch (err) {
    console.error("[OFF lookup error]", err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim() || "";
  const category = searchParams.get("category")?.trim() || null;
  const barcode = searchParams.get("barcode")?.trim() || null;
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  // BARCODE LOOKUP MODE
  if (barcode) {
    // 1. Check local DB first
    const { data: localByCode, error: localError } = await supabase
      .from("foods")
      .select("*")
      .eq("off_code", barcode)
      .maybeSingle();

    if (!localError && localByCode) {
      return NextResponse.json({
        found: true,
        source: "local",
        food: {
          id: localByCode.id,
          name: localByCode.name,
          category: localByCode.category,
          serving_size_g: localByCode.serving_size_g,
          serving_size_text: localByCode.serving_size_text,
          calories_per_serving: localByCode.calories_per_serving,
          protein_g: localByCode.protein_g,
          carbs_g: localByCode.carbs_g,
          fat_g: localByCode.fat_g,
          source: localByCode.source,
        },
      });
    }

    // 2. Lookup OFF
    const offProduct = await lookupOFF(barcode);
    if (offProduct) {
      // Auto-cache to DB
      const cachedId = await cacheOFFProduct(supabase, offProduct);
      return NextResponse.json({
        found: true,
        source: "off",
        food: {
          id: cachedId,
          name: offProduct.name,
          category: offProduct.category,
          serving_size_g: offProduct.serving_size_g,
          serving_size_text: offProduct.serving_size_text,
          calories_per_serving: Math.round(offProduct.calories),
          protein_g: Math.round(offProduct.protein * 10) / 10,
          carbs_g: Math.round(offProduct.carbs * 10) / 10,
          fat_g: Math.round(offProduct.fat * 10) / 10,
          source: "off",
        },
      });
    }

    return NextResponse.json({ found: false, barcode });
  }

  // SEARCH MODE
  // 1. Search local DB
  const localResults = await searchLocal(
    supabase,
    q,
    category,
    user?.id ?? null,
    limit
  );

  // If we have enough local results, return them
  if (localResults.length >= limit || !q) {
    return NextResponse.json({
      results: localResults,
      source: "local",
      total: localResults.length,
    });
  }

  // 2. If not enough & query exists, search OFF
  const offResults = await searchOFF(q, limit - localResults.length);

  // Cache OFF results to DB in background (don't wait)
  if (offResults.length > 0) {
    // Fire-and-forget cache
    Promise.all(offResults.map((p) => cacheOFFProduct(supabase, p))).catch(() => {});
  }

  // Combine: local first (higher priority), then OFF results
  const combined = [
    ...localResults.map((r) => ({ ...r, source: "local" as const })),
    ...offResults.map((r) => ({
      id: r.code, // Use OFF code as temp ID
      name: r.name,
      category: r.category,
      serving_size_g: r.serving_size_g,
      serving_size_text: r.serving_size_text,
      calories_per_serving: Math.round(r.calories),
      protein_g: Math.round(r.protein * 10) / 10,
      carbs_g: Math.round(r.carbs * 10) / 10,
      fat_g: Math.round(r.fat * 10) / 10,
      source: "off" as const,
      is_user_food: false,
      is_verified: false,
    })),
  ];

  return NextResponse.json({
    results: combined,
    source: offResults.length > 0 ? "local+off" : "local",
    total: combined.length,
    off_count: offResults.length,
  });
}

// POST: Add custom food
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      category,
      serving_size_g,
      serving_size_text,
      calories_per_serving,
      protein_g,
      carbs_g,
      fat_g,
    } = body;

    if (!name || !calories_per_serving) {
      return NextResponse.json(
        { error: "name dan calories_per_serving wajib diisi" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("add_user_food", {
      p_user_id: user.id,
      p_name: name,
      p_category: category || null,
      p_serving_g: serving_size_g || 100,
      p_serving_text: serving_size_text || null,
      p_calories: Math.round(calories_per_serving),
      p_protein: protein_g ?? 0,
      p_carbs: carbs_g ?? 0,
      p_fat: fat_g ?? 0,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, id: data });
  } catch (err) {
    console.error("[add_user_food error]", err);
    return NextResponse.json(
      { error: "Gagal menyimpan makanan", detail: String(err) },
      { status: 500 }
    );
  }
}
