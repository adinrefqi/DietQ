"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
  Star,
  Flame,
} from "lucide-react";
import type { FoodItem, FoodLog } from "@/types/database";
import { BarcodeScanner } from "./BarcodeScanner";

interface FoodLogClientProps {
  popularFoods: FoodItem[];
  todayLogs: FoodLog[];
}

// API search result type
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
  source: "local" | "off";
  is_user_food?: boolean;
}

type Tab = "camera" | "barcode" | "search" | "today";

const MEALS = [
  { value: "breakfast", label: "Sarapan" },
  { value: "lunch", label: "Makan Siang" },
  { value: "dinner", label: "Makan Malam" },
  { value: "snack", label: "Snack" },
] as const;

const CATEGORIES = [
  { value: "", label: "Semua" },
  { value: "nasi", label: "🍚 Nasi" },
  { value: "daging", label: "🍗 Ayam/Sapi" },
  { value: "ikan", label: "🐟 Ikan" },
  { value: "sayur", label: "🥬 Sayur" },
  { value: "buah", label: "🍎 Buah" },
  { value: "snack", label: "🍿 Snack" },
  { value: "minuman", label: "🥤 Minuman" },
  { value: "instant", label: "🥢 Instant" },
  { value: "dessert", label: "🍰 Dessert" },
] as const;

export function FoodLogClient({ popularFoods, todayLogs }: FoodLogClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeal, setSelectedMeal] = useState<string>("lunch");
  const [servingMultiplier, setServingMultiplier] = useState(1);
  const [cameraImage, setCameraImage] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<unknown>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFood, setSelectedFood] = useState<SearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showAddFood, setShowAddFood] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabase = createClient();

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      // Show popular foods when no query
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.set("q", searchQuery);
        if (selectedCategory) params.set("category", selectedCategory);
        params.set("limit", "30");

        const res = await fetch(`/api/foods/search?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results ?? []);
        }
      } catch (err) {
        console.error("[search error]", err);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, selectedCategory]);

  // Filter foods by search (for popular display)
  const filteredFoods = searchQuery.trim()
    ? searchResults
    : popularFoods.map((f) => ({ ...f, source: "local" as const, is_user_food: false }));

  // Image compression
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

  // Handle image upload
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

  // AI recognition
  const handleAIRecognize = async () => {
    if (!cameraImage) return;
    setLoadingAI(true);

    try {
      const res = await fetch("/api/ai/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: cameraImage.split(",")[1] }),
      });
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
      setSelectedFood(null);
      setActiveTab("today");
      window.location.reload();
    } catch (err) {
      alert(`Gagal menyimpan: ${err}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick add from search
  const handleQuickAdd = (food: SearchResult) => {
    setSelectedFood(food);
    setServingMultiplier(1);
  };

  const confirmQuickAdd = () => {
    if (!selectedFood) return;
    handleSubmitLog({
      food_name: selectedFood.name,
      calories: Math.round(selectedFood.calories_per_serving * servingMultiplier),
      protein_g: Math.round(selectedFood.protein_g * servingMultiplier * 10) / 10,
      carbs_g: Math.round(selectedFood.carbs_g * servingMultiplier * 10) / 10,
      fat_g: Math.round(selectedFood.fat_g * servingMultiplier * 10) / 10,
      serving_size_g: Math.round(selectedFood.serving_size_g * servingMultiplier),
      food_id: selectedFood.source === "local" ? selectedFood.id : undefined,
      input_method: "manual",
    });
  };

  // Add custom food
  const handleAddCustomFood = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    setSubmitting(true);
    try {
      const res = await fetch("/api/foods/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          category: formData.get("category") || null,
          serving_size_g: parseInt(formData.get("serving_size_g") as string) || 100,
          serving_size_text: formData.get("serving_size_text") || null,
          calories_per_serving: parseInt(formData.get("calories") as string) || 0,
          protein_g: parseFloat(formData.get("protein") as string) || 0,
          carbs_g: parseFloat(formData.get("carbs") as string) || 0,
          fat_g: parseFloat(formData.get("fat") as string) || 0,
        }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan");
      const data = await res.json();

      // Add the new food
      handleSubmitLog({
        food_name: formData.get("name") as string,
        calories: parseInt(formData.get("calories") as string) || 0,
        protein_g: parseFloat(formData.get("protein") as string) || 0,
        carbs_g: parseFloat(formData.get("carbs") as string) || 0,
        fat_g: parseFloat(formData.get("fat") as string) || 0,
        serving_size_g: parseInt(formData.get("serving_size_g") as string) || 100,
        food_id: data.id,
        input_method: "manual",
      });

      setShowAddFood(false);
      (form as HTMLFormElement).reset();
    } catch (err) {
      alert(`Error: ${err}`);
    } finally {
      setSubmitting(false);
    }
  };

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
          <button
            onClick={() => setShowAddFood(true)}
            className="ml-auto flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            Custom
          </button>
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
              {MEALS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setSelectedMeal(m.value)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                    selectedMeal === m.value
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {!cameraImage ? (
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
            <div className="flex gap-2">
              {MEALS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setSelectedMeal(m.value)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                    selectedMeal === m.value
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                  }`}
                >
                  {m.label}
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
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-2 ring-green-500">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-zinc-900">{selectedFood.name}</p>
                    {selectedFood.source === "off" && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                        OFF
                      </span>
                    )}
                  </div>
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
                    { label: "Protein", value: `${Math.round(selectedFood.protein_g * servingMultiplier * 10) / 10}g` },
                    { label: "Karbo", value: `${Math.round(selectedFood.carbs_g * servingMultiplier * 10) / 10}g` },
                    { label: "Lemak", value: `${Math.round(selectedFood.fat_g * servingMultiplier * 10) / 10}g` },
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
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
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
                placeholder="Cari makanan Indonesia..."
                className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-zinc-400" />
              )}
            </div>

            {/* Category filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedCategory === cat.value
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Food list */}
            <div className="space-y-2">
              {filteredFoods.length > 0 ? (
                filteredFoods.slice(0, 30).map((food) => (
                  <button
                    key={food.id}
                    onClick={() => handleQuickAdd(food)}
                    className="flex w-full items-center justify-between rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-50 hover:ring-zinc-300"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-900 truncate">{food.name}</p>
                        {food.source === "off" && (
                          <span className="flex-shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                            Global
                          </span>
                        )}
                        {food.is_user_food && (
                          <span className="flex-shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">{food.serving_size_text || `${food.serving_size_g}g`}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="font-semibold text-zinc-900">{food.calories_per_serving} kcal</p>
                      <p className="text-xs text-zinc-500">P: {food.protein_g}g</p>
                    </div>
                  </button>
                ))
              ) : searchQuery && !isSearching ? (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                    <Search className="h-6 w-6 text-zinc-400" />
                  </div>
                  <p className="text-zinc-500">Tidak ada hasil untuk "{searchQuery}"</p>
                  <button
                    onClick={() => setShowAddFood(true)}
                    className="mt-3 text-sm font-medium text-green-600 hover:text-green-700"
                  >
                    + Tambah manual
                  </button>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-zinc-400">Ketik untuk cari makanan atau pilih dari daftar populer</p>
                </div>
              )}
            </div>

            {/* Popular foods (when no search) */}
            {!searchQuery && popularFoods.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                  <Flame className="h-4 w-4" />
                  Populer
                </div>
                {popularFoods.slice(0, 20).map((food) => (
                  <button
                    key={food.id}
                    onClick={() => handleQuickAdd({ ...food, source: "local" as const })}
                    className="flex w-full items-center justify-between rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-50"
                  >
                    <div>
                      <p className="font-medium text-zinc-900">{food.name}</p>
                      <p className="text-xs text-zinc-500">{food.serving_size_text || `${food.serving_size_g}g`}</p>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900">{food.calories_per_serving} kcal</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TODAY TAB ── */}
        {activeTab === "today" && (
          <div className="space-y-3">
            {todayLogs.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                  <Check className="h-6 w-6 text-zinc-400" />
                </div>
                <p className="text-zinc-400">Belum ada makanan hari ini</p>
                <button
                  onClick={() => setActiveTab("search")}
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
                      {MEALS.find((m) => m.value === log.meal_type)?.label ?? log.meal_type}
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

      {/* ── ADD CUSTOM FOOD MODAL ── */}
      {showAddFood && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900">Tambah Makanan Custom</h2>
              <button onClick={() => setShowAddFood(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddCustomFood} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Nama Makanan *</label>
                <input
                  name="name"
                  required
                  placeholder="Contoh: Nasi Goreng Spesial"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Porsi (gram) *</label>
                  <input
                    name="serving_size_g"
                    type="number"
                    defaultValue="100"
                    min="1"
                    required
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Kategori</label>
                  <select
                    name="category"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  >
                    <option value="">Pilih...</option>
                    {CATEGORIES.filter((c) => c.value).map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Kalori (kcal) *</label>
                <input
                  name="calories"
                  type="number"
                  min="0"
                  required
                  placeholder="0"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Protein (g)</label>
                  <input
                    name="protein"
                    type="number"
                    min="0"
                    step="0.1"
                    defaultValue="0"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Karbo (g)</label>
                  <input
                    name="carbs"
                    type="number"
                    min="0"
                    step="0.1"
                    defaultValue="0"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Lemak (g)</label>
                  <input
                    name="fat"
                    type="number"
                    min="0"
                    step="0.1"
                    defaultValue="0"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Simpan & Tambah
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
