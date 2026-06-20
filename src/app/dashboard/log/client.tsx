"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Camera,
  Search,
  Plus,
  X,
  Loader2,
  Check,
  ChevronLeft,
  ScanLine,
} from "lucide-react";
import type { FoodItem, FoodLog } from "@/types/database";
import { BarcodeScanner } from "./BarcodeScanner";

interface FoodLogClientProps {
  foods: FoodItem[];
  todayLogs: FoodLog[];
}

type Tab = "camera" | "barcode" | "search" | "today";

export function FoodLogClient({ foods, todayLogs }: FoodLogClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("camera");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeal, setSelectedMeal] = useState<string>("lunch");
  const [servingMultiplier, setServingMultiplier] = useState(1);
  const [cameraImage, setCameraImage] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<unknown>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  // Filter foods by search
  const filteredFoods = foods.filter((f: FoodItem) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Perkecil + kompres gambar di browser sebelum dikirim ke API.
  // WAJIB: foto kamera HP bisa 3–8 MB; base64-nya menembus batas body Vercel
  // (~4.5 MB) → server balas teks "Request Entity Too Large" (bukan JSON) →
  // res.json() crash. Downscale ke maks 1024px + JPEG 0.7 → ratusan KB saja.
  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1024;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width >= height) {
              height = Math.round((height * MAX) / width);
              width = MAX;
            } else {
              width = Math.round((width * MAX) / height);
              height = MAX;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas tidak didukung"));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.onerror = () => reject(new Error("Gambar tidak bisa dibaca"));
        img.src = ev.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Gagal membaca file"));
      reader.readAsDataURL(file);
    });

  // Handle image upload from camera/file
  const handleImageChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setCameraImage(compressed);
      setAiResult(null);
    } catch (err) {
      alert(`Gagal memproses gambar: ${err}`);
    }
  }, []);

  // Call AI to recognize food
  const handleAIRecognize = async () => {
    if (!cameraImage) return;
    setLoadingAI(true);

    try {
      const res = await fetch("/api/ai/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: cameraImage.split(",")[1] }),
      });
      // Server bisa balas teks polos (mis. 413 "Request Entity Too Large" dari
      // Vercel) yang bukan JSON → jangan langsung res.json() supaya tak crash.
      const text = await res.text();
      if (!res.ok) {
        if (res.status === 413) {
          throw new Error("Foto terlalu besar. Coba foto ulang / pilih gambar lebih kecil.");
        }
        let msg = text;
        try { msg = JSON.parse(text).error ?? text; } catch {}
        throw new Error(msg);
      }
      const data = JSON.parse(text);
      setAiResult(data.nutrition);
    } catch (err) {
      alert(`Gagal mengenali makanan: ${err}`);
    } finally {
      setLoadingAI(false);
    }
  };

  // Submit food log
  const handleSubmitLog = async (data: {
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    serving_size_g: number;
    food_id?: string;
    input_method: "manual" | "ai_vision";
    ai_confidence?: number;
  }) => {
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("food_logs").insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        log_date: today,
        meal_type: selectedMeal,
        meal_time: new Date().toISOString(),
        input_method: data.input_method,
        food_id: data.food_id ?? null,
        food_name: data.food_name,
        serving_size_g: data.serving_size_g,
        calories: data.calories,
        protein_g: data.protein_g,
        carbs_g: data.carbs_g,
        fat_g: data.fat_g,
        ai_confidence: data.ai_confidence,
      });
      if (error) throw error;
      // Reset
      setCameraImage(null);
      setAiResult(null);
      setActiveTab("today");
      // Refresh page to show new log
      window.location.reload();
    } catch (err) {
      alert(`Gagal menyimpan: ${err}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick add from database food
  const handleQuickAdd = (food: FoodItem) => {
    setSelectedFood(food);
    setServingMultiplier(1);
  };

  const confirmQuickAdd = () => {
    if (!selectedFood) return;
    handleSubmitLog({
      food_name: selectedFood.name,
      calories: selectedFood.calories_per_serving * servingMultiplier,
      protein_g: selectedFood.protein_g * servingMultiplier,
      carbs_g: selectedFood.carbs_g * servingMultiplier,
      fat_g: selectedFood.fat_g * servingMultiplier,
      serving_size_g: selectedFood.serving_size_g * servingMultiplier,
      food_id: selectedFood.id,
      input_method: "manual",
    });
  };

  // Tab definitions
  const tabs = [
    { id: "camera", label: "Kamera", icon: Camera },
    { id: "barcode", label: "Scan", icon: ScanLine },
    { id: "search", label: "Cari", icon: Search },
    { id: "today", label: "Hari Ini", icon: Check },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-4 py-4 sticky top-0 z-10">
        <div className="mx-auto max-w-2xl flex items-center gap-4">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-800">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-zinc-900">Catat Makanan</h1>
        </div>
        {/* Tabs */}
        <div className="mx-auto max-w-2xl mt-3 flex gap-1 bg-zinc-100 p-1 rounded-xl">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {/* ── CAMERA TAB ── */}
        {activeTab === "camera" && (
          <div className="space-y-4">
            {/* Meal selector */}
            <div className="flex gap-2">
              {(["breakfast", "lunch", "dinner", "snack"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMeal(m)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                    selectedMeal === m
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                  }`}
                >
                  {m === "breakfast" ? "Sarapan" : m === "lunch" ? "Makan Siang" : m === "dinner" ? "Makan Malam" : "Snack"}
                </button>
              ))}
            </div>

            {!cameraImage ? (
              /* Upload area */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-white py-16 text-zinc-400 cursor-pointer hover:border-zinc-500 hover:text-zinc-600"
              >
                <Camera className="h-12 w-12 mb-3" />
                <p className="font-medium text-zinc-600">Tap untuk foto makanan</p>
                <p className="mt-1 text-sm text-zinc-400">JPG, PNG, WebP</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            ) : (
              /* Preview + AI result */
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden bg-black">
                  <img src={cameraImage} alt="Preview" className="w-full h-64 object-contain" />
                  <button
                    onClick={() => { setCameraImage(null); setAiResult(null); }}
                    className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* AI Result */}
                {aiResult ? (
                  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold text-zinc-900">{(aiResult as { makanan: string }).makanan}</p>
                      <button
                        onClick={() => handleSubmitLog({
                          food_name: (aiResult as { makanan: string }).makanan,
                          calories: (aiResult as { kalori: number }).kalori,
                          protein_g: (aiResult as { protein_g: number }).protein_g,
                          carbs_g: (aiResult as { karbohidrat_g: number }).karbohidrat_g,
                          fat_g: (aiResult as { lemak_g: number }).lemak_g,
                          serving_size_g: (aiResult as { perkiraan_gram: number }).perkiraan_gram,
                          input_method: "ai_vision",
                          ai_confidence: 0.85,
                        })}
                        disabled={submitting}
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Tambah
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      {[
                        { label: "Kalori", value: `${(aiResult as { kalori: number }).kalori} kcal` },
                        { label: "Protein", value: `${(aiResult as { protein_g: number }).protein_g}g` },
                        { label: "Karbo", value: `${(aiResult as { karbohidrat_g: number }).karbohidrat_g}g` },
                        { label: "Lemak", value: `${(aiResult as { lemak_g: number }).lemak_g}g` },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg bg-zinc-50 p-2">
                          <p className="text-xs text-zinc-500">{item.label}</p>
                          <p className="mt-0.5 font-semibold text-zinc-900">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">
                      AI estimation · {(aiResult as { perkiraan_gram: number }).perkiraan_gram}g
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleAIRecognize}
                    disabled={loadingAI}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-4 text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {loadingAI ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Mengenali makanan...
                      </>
                    ) : (
                      <>
                        <Camera className="h-5 w-5" />
                        Kenali dengan AI
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── BARCODE TAB ── */}
        {activeTab === "barcode" && (
          <div className="space-y-4">
            {/* Meal selector (sama seperti tab kamera) */}
            <div className="flex gap-2">
              {(["breakfast", "lunch", "dinner", "snack"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMeal(m)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                    selectedMeal === m
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                  }`}
                >
                  {m === "breakfast" ? "Sarapan" : m === "lunch" ? "Makan Siang" : m === "dinner" ? "Makan Malam" : "Snack"}
                </button>
              ))}
            </div>

            <BarcodeScanner
              submitting={submitting}
              onAdd={(food) =>
                handleSubmitLog({ ...food, input_method: "manual" })
              }
            />
          </div>
        )}

        {/* ── SEARCH TAB ── */}
        {activeTab === "search" && (
          <div className="space-y-3">
            {/* Selected food confirmation */}
            {selectedFood && (
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-2 ring-zinc-900">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-zinc-900">{selectedFood.name}</p>
                  <button onClick={() => setSelectedFood(null)} className="text-zinc-400 hover:text-zinc-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {/* Serving multiplier */}
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => setServingMultiplier((m) => Math.max(0.5, m - 0.5))}
                    className="h-8 w-8 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  >
                    −
                  </button>
                  <span className="flex-1 text-center font-medium text-zinc-900">
                    {servingMultiplier}× ({Math.round(selectedFood.serving_size_g * servingMultiplier)}g)
                  </span>
                  <button
                    onClick={() => setServingMultiplier((m) => m + 0.5)}
                    className="h-8 w-8 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  >
                    +
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                  {[
                    { label: "Kalori", value: `${Math.round(selectedFood.calories_per_serving * servingMultiplier)}` },
                    { label: "Protein", value: `${Math.round(selectedFood.protein_g * servingMultiplier)}g` },
                    { label: "Karbo", value: `${Math.round(selectedFood.carbs_g * servingMultiplier)}g` },
                    { label: "Lemak", value: `${Math.round(selectedFood.fat_g * servingMultiplier)}g` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-zinc-50 p-1.5">
                      <p className="text-xs text-zinc-500">{item.label}</p>
                      <p className="text-sm font-semibold text-zinc-900">{item.value}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={confirmQuickAdd}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Tambah ke log
                </button>
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari makanan..."
                className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            {/* Food list */}
            <div className="space-y-2">
              {filteredFoods.slice(0, 20).map((food: FoodItem) => (
                <button
                  key={food.id}
                  onClick={() => handleQuickAdd(food)}
                  className="flex w-full items-center justify-between rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-50"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{food.name}</p>
                    <p className="text-xs text-zinc-500">{food.serving_size_text}</p>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {food.calories_per_serving} kcal
                  </p>
                </button>
              ))}
              {filteredFoods.length === 0 && searchQuery && (
                <p className="py-8 text-center text-sm text-zinc-400">Tidak ada hasil untuk "{searchQuery}"</p>
              )}
            </div>
          </div>
        )}

        {/* ── TODAY TAB ── */}
        {activeTab === "today" && (
          <div className="space-y-3">
            {todayLogs.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-zinc-400">Belum ada makanan hari ini</p>
                <button
                  onClick={() => setActiveTab("camera")}
                  className="mt-3 text-sm font-medium text-zinc-900 underline underline-offset-4"
                >
                  + Catat makanan
                </button>
              </div>
            ) : (
              todayLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
                  <div>
                    <p className="font-medium text-zinc-900">{log.food_name}</p>
                    <p className="text-xs text-zinc-500">
                      {log.meal_type === "breakfast" ? "Sarapan" : log.meal_type === "lunch" ? "Makan Siang" : log.meal_type === "dinner" ? "Makan Malam" : "Snack"}
                      {log.serving_size_g ? ` · ${log.serving_size_g}g` : ""}
                    </p>
                  </div>
                  <p className="font-semibold text-zinc-900">{Math.round(log.calories)} kcal</p>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
