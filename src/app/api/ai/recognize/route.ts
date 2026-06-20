// API route: POST /api/ai/recognize
// Body: { imageBase64: string }  →  { nutrition: NutritionEstimation }
// ⚠️ Server-side only — API key di .env server

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { estimateNutritionFromImage } from "@/lib/llm";

export async function POST(request: NextRequest) {
  // 1. Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: { imageBase64?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.imageBase64) {
    return NextResponse.json(
      { error: "imageBase64 is required" },
      { status: 400 }
    );
  }

  // 3. Pastikan format data URI
  const imageDataURI = body.imageBase64.startsWith("data:")
    ? body.imageBase64
    : `data:image/jpeg;base64,${body.imageBase64}`;

  // 4. Call LLM
  try {
    const nutrition = await estimateNutritionFromImage(imageDataURI);

    return NextResponse.json({ nutrition });
  } catch (err) {
    console.error("[AI recognize error]", err);
    return NextResponse.json(
      { error: "Failed to analyze image", detail: String(err) },
      { status: 500 }
    );
  }
}
