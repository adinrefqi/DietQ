"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ChevronLeft, Loader2, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { Profile, UserGoals } from "@/types/database";
import type { User } from "@supabase/supabase-js";

interface ProfileClientProps {
  user: User;
  profile: Profile | null;
  goals: UserGoals | null;
}

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Jarang bergerak (kantor)" },
  { value: "light", label: "Olahraga ringan 1-3x/minggu" },
  { value: "moderate", label: "Olahraga sedang 3-5x/minggu" },
  { value: "active", label: "Olahraga berat 6-7x/minggu" },
  { value: "very_active", label: "Sangat aktif / atlet" },
];

export function ProfileClient({ user, profile, goals }: ProfileClientProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [gender, setGender] = useState<string>(profile?.gender ?? "other");
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? "");
  const [heightCm, setHeightCm] = useState(profile?.height_cm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(profile?.current_weight_kg?.toString() ?? "");
  const [activityLevel, setActivityLevel] = useState<Profile["activity_level"]>(profile?.activity_level ?? "moderate");

  const [calTarget, setCalTarget] = useState(goals?.daily_calorie_target?.toString() ?? "2000");
  const [proteinTarget, setProteinTarget] = useState(goals?.daily_protein_g?.toString() ?? "150");
  const [carbsTarget, setCarbsTarget] = useState(goals?.daily_carbs_g?.toString() ?? "200");
  const [fatTarget, setFatTarget] = useState(goals?.daily_fat_g?.toString() ?? "65");
  const [waterTarget, setWaterTarget] = useState(goals?.daily_water_ml?.toString() ?? "2000");
  const [targetWeight, setTargetWeight] = useState(goals?.target_weight_kg?.toString() ?? "");

  const supabase = createClient();

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          gender: gender as Profile["gender"],
          birth_date: birthDate || null,
          height_cm: parseFloat(heightCm) || null,
          current_weight_kg: parseFloat(weightKg) || null,
          activity_level: activityLevel as Profile["activity_level"],
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      const { error: goalsError } = await supabase
        .from("user_goals")
        .update({
          daily_calorie_target: parseInt(calTarget) || 2000,
          daily_protein_g: parseInt(proteinTarget) || 150,
          daily_carbs_g: parseInt(carbsTarget) || 200,
          daily_fat_g: parseInt(fatTarget) || 65,
          daily_water_ml: parseInt(waterTarget) || 2000,
          target_weight_kg: parseFloat(targetWeight) || null,
        })
        .eq("user_id", user.id);

      if (goalsError) throw goalsError;

      setMessage("✅ Profil berhasil disimpan!");
    } catch (err) {
      setMessage(`❌ Gagal menyimpan: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  const bmi = (() => {
    const h = parseFloat(heightCm);
    const w = parseFloat(weightKg);
    if (h && w) return (w / ((h / 100) ** 2)).toFixed(1);
    return null;
  })();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-4 sticky top-0 z-10 transition-colors">
        <div className="mx-auto max-w-2xl flex items-center gap-4">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Profil & Target</h1>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        {message && (
          <div className={`rounded-xl p-3 text-sm ${message.startsWith("✅") ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"}`}>
            {message}
          </div>
        )}

        {/* Data Diri */}
        <section className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Data Diri</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Nama</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Email</label>
              <input type="email" value={user.email ?? ""} readOnly className="w-full cursor-not-allowed rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-500 dark:text-zinc-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700">
                  <option value="male">Laki-laki</option>
                  <option value="female">Perempuan</option>
                  <option value="other">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Tgl Lahir</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Tinggi (cm)</label>
                <input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="170" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Berat (kg)</label>
                <input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700" />
              </div>
            </div>
            {bmi && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 px-3 py-2 text-sm">
                <span className="font-medium text-blue-900 dark:text-blue-300">BMI: {bmi}</span>
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  {parseFloat(bmi) < 18.5 ? "Kurus" : parseFloat(bmi) < 25 ? "Normal" : parseFloat(bmi) < 30 ? "Berlebih" : "Obesitas"}
                </span>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Aktivitas</label>
              <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as Profile["activity_level"])} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700">
                {ACTIVITY_LEVELS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Target Nutrisi */}
        <section className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-colors">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Target Harian</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Kalori", value: calTarget, setter: setCalTarget, unit: "kcal" },
              { label: "Protein", value: proteinTarget, setter: setProteinTarget, unit: "g" },
              { label: "Karbohidrat", value: carbsTarget, setter: setCarbsTarget, unit: "g" },
              { label: "Lemak", value: fatTarget, setter: setFatTarget, unit: "g" },
            ].map((field) => (
              <div key={field.label}>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{field.label} ({field.unit})</label>
                <input
                  type="number"
                  value={field.value}
                  onChange={(e) => field.setter(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Air (ml)</label>
              <input type="number" value={waterTarget} onChange={(e) => setWaterTarget(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Berat Target (kg)</label>
              <input type="number" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} placeholder="Opsional" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700" />
            </div>
          </div>
        </section>

        {/* Actions */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 dark:bg-emerald-600 py-3.5 text-sm font-semibold text-white hover:bg-emerald-500 dark:hover:bg-emerald-500 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Simpan Perubahan
        </button>

        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-800 py-3.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </button>
      </main>
    </div>
  );
}
