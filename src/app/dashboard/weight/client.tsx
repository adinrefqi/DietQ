"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { ChevronLeft, Scale, Plus, Loader2, Trash2, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { Profile, WeightLog } from "@/types/database";

interface WeightClientProps {
  profile: Profile | null;
  targetWeight: number | null;
  logs: WeightLog[];
  today: string;
}

function bmiOf(weightKg: number, heightCm: number | null | undefined): number | null {
  if (!heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

function bmiCategory(bmi: number | null): { label: string; color: string } {
  if (bmi === null) return { label: "—", color: "text-zinc-400 dark:text-zinc-500" };
  if (bmi < 18.5) return { label: "Kurus", color: "text-amber-600 dark:text-amber-400" };
  if (bmi < 25) return { label: "Normal", color: "text-green-600 dark:text-green-400" };
  if (bmi < 30) return { label: "Berlebih", color: "text-orange-600 dark:text-orange-400" };
  return { label: "Obesitas", color: "text-red-600 dark:text-red-400" };
}

export function WeightClient({ profile, targetWeight, logs, today }: WeightClientProps) {
  const supabase = createClient();
  const [weight, setWeight] = useState("");
  const [logDate, setLogDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const heightCm = profile?.height_cm ?? null;
  const latest = logs.length > 0 ? logs[logs.length - 1] : null;
  const latestWeight = latest?.weight_kg ?? profile?.current_weight_kg ?? null;
  const latestBmi = latestWeight !== null ? bmiOf(latestWeight, heightCm) : null;
  const cat = bmiCategory(latestBmi);

  async function handleSave() {
    const w = parseFloat(weight);
    if (!w || w <= 0 || w > 500) {
      alert("Masukkan berat yang valid (kg).");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("weight_logs").insert({
        user_id: user?.id,
        weight_kg: w,
        log_date: logDate,
      });
      if (error) throw error;
      await supabase.from("profiles").update({ current_weight_kg: w }).eq("id", user?.id);
      window.location.reload();
    } catch (err) {
      alert(`Gagal menyimpan: ${err instanceof Error ? err.message : err}`);
      setSaving(false);
    }
  }

  async function handleDelete(logId: string) {
    if (!confirm("Hapus catatan berat ini?")) return;
    setDeletingId(logId);
    try {
      const { error } = await supabase.from("weight_logs").delete().eq("id", logId);
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      alert(`Gagal menghapus: ${err instanceof Error ? err.message : err}`);
      setDeletingId(null);
    }
  }

  const weights = logs.map((l) => l.weight_kg);
  const minW = weights.length ? Math.min(...weights) : 0;
  const maxW = weights.length ? Math.max(...weights) : 0;
  const range = maxW - minW || 1;
  const history = [...logs].reverse();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-4 sticky top-0 z-10 transition-colors">
        <div className="mx-auto max-w-2xl flex items-center gap-4">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Berat Badan</h1>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        {/* Ringkasan */}
        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-1">
              <Scale className="h-4 w-4" />
              <span className="text-xs font-medium">Sekarang</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{latestWeight ?? "—"}</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">kg</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-1">
              <span className="text-xs font-medium">BMI</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {latestBmi !== null ? latestBmi.toFixed(1) : "—"}
            </p>
            <p className={`mt-1 text-xs font-medium ${cat.color}`}>{cat.label}</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs font-medium">Target</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{targetWeight ?? "—"}</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">kg</p>
          </div>
        </section>

        {/* Form catat */}
        <section className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Catat Berat Hari Ini</h2>
          {!heightCm && (
            <p className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              Tinggi badan belum diisi — BMI tidak bisa dihitung.{" "}
              <Link href="/dashboard/profile" className="font-semibold underline">
                Isi di profil
              </Link>
            </p>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="mis. 65.5"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-3 pl-4 pr-10 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-900"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 dark:text-zinc-500">
                kg
              </span>
            </div>
            <input
              type="date"
              value={logDate}
              max={today}
              onChange={(e) => setLogDate(e.target.value)}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-3 text-sm text-zinc-700 dark:text-zinc-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-900"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Simpan
          </button>
        </section>

        {/* Grafik tren */}
        {logs.length > 0 && (
          <section className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tren Berat</h2>
            <div className="flex items-end gap-1.5 h-36">
              {logs.map((l) => {
                const h = 20 + ((l.weight_kg - minW) / range) * 80;
                const isLatest = l.id === latest?.id;
                return (
                  <div key={l.id} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{l.weight_kg}</span>
                    <div className="w-full flex flex-col justify-end" style={{ height: "100px" }}>
                      <div
                        className={`w-full rounded-sm transition-all ${
                          isLatest ? "bg-blue-500 dark:bg-blue-600" : "bg-zinc-200 dark:bg-zinc-700"
                        }`}
                        style={{ height: `${h}%` }}
                        title={`${l.weight_kg} kg`}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                      {format(parseISO(l.log_date), "d/M", { locale: id })}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Riwayat */}
        <section className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Riwayat</h2>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">Belum ada catatan berat.</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {history.map((l) => {
                const b = bmiOf(l.weight_kg, heightCm);
                return (
                  <div key={l.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{l.weight_kg} kg</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {format(parseISO(l.log_date), "EEEE, d MMM yyyy", { locale: id })}
                        {b !== null ? ` · BMI ${b.toFixed(1)}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(l.id)}
                      disabled={deletingId === l.id}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-zinc-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      aria-label="Hapus"
                    >
                      {deletingId === l.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
