// LLM client untuk backend (API routes) — konektor ke arkoda gateway
// ⚠️ JANGAN import di client-side (browser) — API key harus di server!

import OpenAI from "openai";
import type { NutritionEstimation } from "@/types/database";

// ⚠️ Pakai prefix ARKODA_ (bukan ANTHROPIC_) supaya TIDAK bentrok dengan env
// var sistem (mis. ANTHROPIC_BASE_URL milik Claude Code). Next.js tidak menimpa
// env var yang sudah ada di shell, jadi nama ANTHROPIC_* bisa nyasar gateway.
const MODEL = process.env.ARKODA_MODEL ?? "kr/claude-opus-4.6";

// ⚠️ Client dibuat LAZY (bukan di level modul). Kalau di-instantiate saat import,
// `next build` (collecting page data) ikut import route ini dan langsung error
// "Missing credentials" karena ARKODA_API_KEY belum tersedia saat build.
// Dengan lazy, key baru dibutuhkan saat ada request nyata.
let _llm: OpenAI | null = null;
function getLLM(): OpenAI {
  if (_llm) return _llm;
  const base = (process.env.ARKODA_BASE_URL ?? "https://api.arkoda.cloud").replace(
    /\/+$/,
    ""
  );
  const apiKey = process.env.ARKODA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ARKODA_API_KEY belum di-set. Tambahkan di Environment Variables Vercel (atau .env.local untuk lokal)."
    );
  }
  _llm = new OpenAI({ baseURL: `${base}/v1`, apiKey });
  return _llm;
}

const SYSTEM_NUTRITION = `Kamu ahli gizi Indonesia. Balas HANYA JSON (tanpa markdown/preamble/fence):
{"makanan":"nama","perkiraan_gram":150,"kalori":200,"protein_g":10,"karbohidrat_g":25,"lemak_g":8,"kategori":"makanan utama"}`;

/** Kirim gambar makanan → estimasi nutrisi (JSON) */
export async function estimateNutritionFromImage(
  imageDataURI: string
): Promise<NutritionEstimation> {
  const res = await getLLM().chat.completions.create({
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
  const res = await getLLM().chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  return res.choices[0]?.message?.content ?? "";
}
