"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ChevronLeft, Loader2, LogOut } from "lucide-react";
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

const MEAL_TYPES = [
  { value: "breakfast", label: "Sarapan" },
  { value: "lunch", label: "Makan Siang" },
  { value: "dinner", label: "Makan Malam" },
  { value: "snack", label: "Snack" },
];

export function ProfileClient({ user, profile, goals }: ProfileClientProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Profile fields
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [gender, setGender] = useState<string>(profile?.gender ?? "other");
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? "");
  const [heightCm, setHeightCm] = useState(profile?.height_cm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(profile?.current_weight_kg?.toString() ?? "");
  const [activityLevel, setActivityLevel] = useState<Profile["activity_level"]>(profile?.activity_level ?? "moderate");

  // Goals fields
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
      // Update profile
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

      // Update goals
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

  // Hitung BMI
  const bmi = (() => {
    const h = parseFloat(heightCm);
    const w = parseFloat(weightKg);
    if (h && w) return (w / ((h / 100) ** 2)).toFixed(1);
    return null;
  })();

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-4 py-4 sticky top-0 z-10">
        <div className="mx-auto max-w-2xl flex items-center gap-4">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-800">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-zinc-900">Profil & Target</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        {message && (
          <div className={`rounded-xl p-3 text-sm ${message.startsWith("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {message}
          </div>
        )}

        {/* ── Data Diri ── */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">Data Diri</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Nama</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Email</label>
              <input type="email" value={user.email ?? ""} readOnly className="w-full cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200">
                  <option value="male">Laki-laki</option>
                  <option value="female">Perempuan</option>
                  <option value="other">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Tgl Lahir</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Tinggi (cm)</label>
                <input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="170" className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Berat (kg)</label>
                <input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200" />
              </div>
            </div>
            {bmi && (
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm">
                <span className="font-medium text-blue-900">BMI: {bmi}</span>
                <span className="ml-2 text-blue-600">
                  {parseFloat(bmi) < 18.5 ? "Kurus" : parseFloat(bmi) < 25 ? "Normal" : parseFloat(bmi) < 30 ? "Berlebih" : "Obesitas"}
                </span>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Aktivitas</label>
              <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as Profile["activity_level"])} className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200">
                {ACTIVITY_LEVELS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ── Target Nutrisi ── */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">Target Harian</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Kalori", value: calTarget, setter: setCalTarget, unit: "kcal", color: "orange" },
              { label: "Protein", value: proteinTarget, setter: setProteinTarget, unit: "g", color: "blue" },
              { label: "Karbohidrat", value: carbsTarget, setter: setCarbsTarget, unit: "g", color: "amber" },
              { label: "Lemak", value: fatTarget, setter: setFatTarget, unit: "g", color: "pink" },
            ].map((field) => (
              <div key={field.label}>
                <label className="mb-1 block text-xs font-medium text-zinc-600">{field.label} ({field.unit})</label>
                <input
                  type="number"
                  value={field.value}
                  onChange={(e) => field.setter(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Air (ml)</label>
              <input type="number" value={waterTarget} onChange={(e) => setWaterTarget(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Berat Target (kg)</label>
              <input type="number" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} placeholder="Opsional" className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200" />
            </div>
          </div>
        </section>

        {/* ── Actions ── */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Simpan Perubahan
        </button>

        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-3.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </button>
      </main>
    </div>
  );
}
