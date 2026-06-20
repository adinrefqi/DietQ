// API route: GET /api/barcode?code=XXXX  → { product } | { found:false }
// Lookup produk via Open Food Facts (publik, tanpa API key). Diproxy di server
// untuk hindari CORS & normalisasi field. ⚠️ Butuh login (anti-abuse proxy).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BarcodeProduct } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "30 g", "250ml", "1.5 L" → angka gram (best-effort; null kalau gagal).
function parseServingGrams(s: unknown): number | null {
  if (typeof s !== "string") return null;
  const m = s.match(/([\d.,]+)\s*(g|gr|gram|ml)?/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  // Auth — endpoint hanya untuk user login.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = request.nextUrl.searchParams.get("code")?.trim();
  if (!code || !/^\d{6,14}$/.test(code)) {
    return NextResponse.json({ error: "Kode barcode tidak valid" }, { status: 400 });
  }

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_id,brands,nutriments,serving_size`;
    const res = await fetch(url, {
      headers: { "User-Agent": "DietQ/1.0 (diet tracking app)" },
      // OFF kadang lambat — beri batas waktu wajar.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Open Food Facts error (${res.status})` },
        { status: 502 }
      );
    }

    const data = await res.json();
    if (data.status !== 1 || !data.product) {
      return NextResponse.json({ found: false, code });
    }

    const p = data.product;
    const n = p.nutriments ?? {};
    const name =
      p.product_name_id || p.product_name || "Produk tanpa nama";
    const brand = (p.brands ?? "").split(",")[0]?.trim();

    const product: BarcodeProduct = {
      code,
      name: brand && !name.toLowerCase().includes(brand.toLowerCase())
        ? `${name} (${brand})`
        : name,
      per100g: {
        calories: Math.round(num(n["energy-kcal_100g"])),
        protein_g: Math.round(num(n["proteins_100g"]) * 10) / 10,
        carbs_g: Math.round(num(n["carbohydrates_100g"]) * 10) / 10,
        fat_g: Math.round(num(n["fat_100g"]) * 10) / 10,
      },
      serving_size_g: parseServingGrams(p.serving_size),
    };

    // Tanpa data kalori, produk tak berguna untuk log.
    if (product.per100g.calories === 0) {
      return NextResponse.json({ found: false, code, reason: "no_nutrition" });
    }

    return NextResponse.json({ found: true, product });
  } catch (err) {
    console.error("[barcode lookup error]", err);
    return NextResponse.json(
      { error: "Gagal menghubungi Open Food Facts", detail: String(err) },
      { status: 500 }
    );
  }
}
