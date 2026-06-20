"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO, addDays, subDays } from "date-fns";
import { id } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FoodLog, MealType } from "@/types/database";

interface HistoryClientProps {
  date: string; // yyyy-MM-dd yang sedang dilihat
  today: string;
  logs: FoodLog[];
}

const MEALS: Array<{ id: MealType; label: string }> = [
  { id: "breakfast", label: "Sarapan" },
  { id: "lunch", label: "Makan Siang" },
  { id: "dinner", label: "Makan Malam" },
  { id: "snack", label: "Snack" },
];

type EditForm = {
  food_name: string;
  meal_type: MealType;
  serving_size_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export function HistoryClient({ date, today, logs }: HistoryClientProps) {
  const supabase = createClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const prevDate = format(subDays(parseISO(date), 1), "yyyy-MM-dd");
  const nextDate = format(addDays(parseISO(date), 1), "yyyy-MM-dd");
  const canNext = date < today;
  const isToday = date === today;

  const dayTotal = logs.reduce(
    (acc, l) => {
      acc.calories += l.calories;
      acc.protein_g += l.protein_g;
      acc.carbs_g += l.carbs_g;
      acc.fat_g += l.fat_g;
      return acc;
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  function startEdit(log: FoodLog) {
    setEditingId(log.id);
    setForm({
      food_name: log.food_name,
      meal_type: (log.meal_type ?? "lunch") as MealType,
      serving_size_g: Math.round(log.serving_size_g ?? 0),
      calories: Math.round(log.calories),
      protein_g: Math.round(log.protein_g),
      carbs_g: Math.round(log.carbs_g),
      fat_g: Math.round(log.fat_g),
    });
  }

  async function saveEdit(id: string) {
    if (!form) return;
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("food_logs")
        .update({
          food_name: form.food_name,
          meal_type: form.meal_type,
          serving_size_g: form.serving_size_g,
          calories: form.calories,
          protein_g: form.protein_g,
          carbs_g: form.carbs_g,
          fat_g: form.fat_g,
        })
        .eq("id", id);
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      alert(`Gagal menyimpan perubahan: ${err}`);
      setBusyId(null);
    }
  }

  async function del(id: string) {
    if (!confirm("Hapus catatan makanan ini?")) return;
    setBusyId(id);
    try {
      const { error } = await supabase.from("food_logs").delete().eq("id", id);
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      alert(`Gagal menghapus: ${err}`);
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-800">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-zinc-900">Riwayat Makanan</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {/* Navigasi tanggal */}
        <div className="flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm ring-1 ring-zinc-200">
          <Link
            href={`/dashboard/history?date=${prevDate}`}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 text-center">
            <CalendarDays className="h-4 w-4 text-zinc-400" />
            <div>
              <p className="font-semibold text-zinc-900">
                {format(parseISO(date), "EEEE, d MMM yyyy", { locale: id })}
              </p>
              {isToday && <p className="text-xs text-zinc-400">Hari ini</p>}
            </div>
          </div>
          {canNext ? (
            <Link
              href={`/dashboard/history?date=${nextDate}`}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
            >
              <ChevronRight className="h-5 w-5" />
            </Link>
          ) : (
            <span className="p-2 text-zinc-200">
              <ChevronRight className="h-5 w-5" />
            </span>
          )}
        </div>

        {/* Total harian */}
        {logs.length > 0 && (
          <div className="grid grid-cols-4 gap-2 rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-zinc-200">
            {[
              { label: "Kalori", value: `${Math.round(dayTotal.calories)}` },
              { label: "Protein", value: `${Math.round(dayTotal.protein_g)}g` },
              { label: "Karbo", value: `${Math.round(dayTotal.carbs_g)}g` },
              { label: "Lemak", value: `${Math.round(dayTotal.fat_g)}g` },
            ].map((it) => (
              <div key={it.label}>
                <p className="text-lg font-bold text-zinc-900">{it.value}</p>
                <p className="text-xs text-zinc-400">{it.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* List per meal */}
        {logs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-zinc-400">Tidak ada catatan di tanggal ini</p>
            {isToday && (
              <Link
                href="/dashboard/log"
                className="mt-3 inline-block text-sm font-medium text-zinc-900 underline underline-offset-4"
              >
                + Catat makanan
              </Link>
            )}
          </div>
        ) : (
          MEALS.map((meal) => {
            const items = logs.filter((l) => l.meal_type === meal.id);
            if (items.length === 0) return null;
            const sub = items.reduce((s, l) => s + l.calories, 0);
            return (
              <section key={meal.id}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-zinc-900">{meal.label}</h2>
                  <span className="text-xs text-zinc-400">{Math.round(sub)} kcal</span>
                </div>
                <div className="space-y-2">
                  {items.map((log) =>
                    editingId === log.id && form ? (
                      /* ── Form edit ── */
                      <div
                        key={log.id}
                        className="space-y-3 rounded-xl bg-white p-3 shadow-sm ring-2 ring-zinc-900"
                      >
                        <input
                          value={form.food_name}
                          onChange={(e) => setForm({ ...form, food_name: e.target.value })}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium focus:border-indigo-500 focus:outline-none"
                          placeholder="Nama makanan"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {MEALS.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setForm({ ...form, meal_type: m.id })}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                                form.meal_type === m.id
                                  ? "border-zinc-900 bg-zinc-900 text-white"
                                  : "border-zinc-200 text-zinc-600"
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {(
                            [
                              ["serving_size_g", "gram"],
                              ["calories", "kkal"],
                              ["protein_g", "P"],
                              ["carbs_g", "K"],
                              ["fat_g", "L"],
                            ] as const
                          ).map(([key, lbl]) => (
                            <label key={key} className="text-center">
                              <span className="mb-0.5 block text-[10px] text-zinc-400">{lbl}</span>
                              <input
                                type="number"
                                min={0}
                                value={form[key]}
                                onChange={(e) =>
                                  setForm({ ...form, [key]: Math.max(0, Number(e.target.value) || 0) })
                                }
                                className="w-full rounded-lg border border-zinc-300 px-1 py-1.5 text-center text-sm focus:border-indigo-500 focus:outline-none"
                              />
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(log.id)}
                            disabled={busyId === log.id}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                          >
                            {busyId === log.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                            Simpan
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setForm(null);
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-600 hover:bg-zinc-50"
                          >
                            <X className="h-4 w-4" />
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Tampilan biasa ── */
                      <div
                        key={log.id}
                        className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-zinc-200"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-zinc-900">{log.food_name}</p>
                          <p className="text-xs text-zinc-500">
                            {Math.round(log.calories)} kcal
                            {log.serving_size_g ? ` · ${Math.round(log.serving_size_g)}g` : ""} · P
                            {Math.round(log.protein_g)} K{Math.round(log.carbs_g)} L
                            {Math.round(log.fat_g)}
                          </p>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => startEdit(log)}
                            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => del(log.id)}
                            disabled={busyId === log.id}
                            className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                            aria-label="Hapus"
                          >
                            {busyId === log.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}
