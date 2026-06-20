// LLM client untuk backend (API routes) — konektor ke arkoda gateway
// ⚠️ JANGAN import di client-side (browser) — API key harus di server!

import OpenAI from "openai";
import type { NutritionEstimation } from "@/types/database";

// ⚠️ Pakai prefix ARKODA_ (bukan ANTHROPIC_) supaya TIDAK bentrok dengan env
// var sistem (mis. ANTHROPIC_BASE_URL milik Claude Code). Next.js tidak menimpa
// env var yang sudah ada di shell, jadi nama ANTHROPIC_* bisa nyasar gateway.
const BASE = (process.env.ARKODA_BASE_URL ?? "https://api.arkoda.cloud").replace(
  /\/+$/,
  ""
);

export const llm = new OpenAI({
  baseURL: `${BASE}/v1`,
  apiKey: process.env.ARKODA_API_KEY!,
});

export const MODEL = process.env.ARKODA_MODEL ?? "kr/claude-opus-4.6";

const SYSTEM_NUTRITION = `Kamu ahli gizi Indonesia. Balas HANYA JSON (tanpa markdown/preamble/fence):
{"makanan":"nama","perkiraan_gram":150,"kalori":200,"protein_g":10,"karbohidrat_g":25,"lemak_g":8,"kategori":"makanan utama"}`;

/** Kirim gambar makanan → estimasi nutrisi (JSON) */
export async function estimateNutritionFromImage(
  imageDataURI: string
): Promise<NutritionEstimation> {
  const res = await llm.chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      { role: "system", content: SYSTEM_NUTRITION },
      {
        role: "user",
        content: [
          { type: "text", text: "Estimasikan nutrisi makanan ini." },
          { type: "image_url", image_url: { url: imageDataURI, detail: "low" } },
        ],
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "";

  // Strip markdown fences
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    return JSON.parse(cleaned) as NutritionEstimation;
  } catch {
    throw new Error(`Gagal parse respons LLM: ${raw.slice(0, 200)}`);
  }
}

/** Prompt teks → jawaban string */
export async function askLLM(prompt: string): Promise<string> {
  const res = await llm.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  return res.choices[0]?.message?.content ?? "";
}
