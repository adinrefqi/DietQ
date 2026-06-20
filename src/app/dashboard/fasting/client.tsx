"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Play,
  Square,
  X,
  Check,
  Hourglass,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FastingSession, FastingProtocol } from "@/types/database";

interface FastingClientProps {
  active: FastingSession | null;
  history: FastingSession[];
}

// Pilihan protokol → jam puasa + deskripsi.
const PROTOCOLS: Array<{
  id: FastingProtocol;
  label: string;
  hours: number;
  desc: string;
}> = [
  { id: "14:10", label: "14:10", hours: 14, desc: "Puasa 14 jam · makan 10 jam (pemula)" },
  { id: "16:8", label: "16:8", hours: 16, desc: "Puasa 16 jam · makan 8 jam (populer)" },
  { id: "18:6", label: "18:6", hours: 18, desc: "Puasa 18 jam · makan 6 jam" },
  { id: "20:4", label: "20:4", hours: 20, desc: "Puasa 20 jam · makan 4 jam (Warrior)" },
  { id: "23:1", label: "23:1 (OMAD)", hours: 23, desc: "Sekali makan sehari" },
];

const HOUR_MS = 3_600_000;

// Format milidetik → "16j 23m 5d"
function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}j ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}d`;
}

// Format jam (waktu) lokal "HH.MM"
function fmtClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}

export function FastingClient({ active, history }: FastingClientProps) {
  const supabase = createClient();
  const [protocol, setProtocol] = useState<FastingProtocol>("16:8");
  const [customHours, setCustomHours] = useState(16);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Tick tiap detik saat ada puasa aktif.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  // ── Mulai puasa ──
  async function startFast() {
    if (busy) return;
    setBusy(true);
    try {
      const isCustom = protocol === "custom";
      const hours = isCustom
        ? customHours
        : PROTOCOLS.find((p) => p.id === protocol)?.hours ?? 16;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("fasting_sessions").insert({
        user_id: user?.id,
        protocol,
        target_hours: hours,
        start_at: new Date().toISOString(),
        end_at: null,
      });
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      alert(`Gagal memulai puasa: ${err}`);
      setBusy(false);
    }
  }

  // ── Selesai puasa (catat end_at) ──
  async function endFast() {
    if (busy || !active) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("fasting_sessions")
        .update({ end_at: new Date().toISOString() })
        .eq("id", active.id);
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      alert(`Gagal menyelesaikan puasa: ${err}`);
      setBusy(false);
    }
  }

  // ── Batalkan puasa (hapus sesi) ──
  async function cancelFast() {
    if (busy || !active) return;
    if (!confirm("Batalkan puasa ini? Sesi tidak akan tersimpan.")) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("fasting_sessions")
        .delete()
        .eq("id", active.id);
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      alert(`Gagal membatalkan: ${err}`);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-800">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-zinc-900">Intermittent Fasting</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        {active ? (
          <ActiveFast
            active={active}
            now={now}
            busy={busy}
            onEnd={endFast}
            onCancel={cancelFast}
          />
        ) : (
          <StartFast
            protocol={protocol}
            setProtocol={setProtocol}
            customHours={customHours}
            setCustomHours={setCustomHours}
            busy={busy}
            onStart={startFast}
          />
        )}

        {/* Riwayat */}
        {history.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-zinc-900">Riwayat</h2>
            <div className="space-y-2">
              {history.map((s) => {
                const durMs =
                  new Date(s.end_at as string).getTime() -
                  new Date(s.start_at).getTime();
                const reached = durMs >= s.target_hours * HOUR_MS;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-zinc-200"
                  >
                    <div>
                      <p className="font-medium text-zinc-900">
                        {s.protocol === "custom" ? `${s.target_hours} jam` : s.protocol}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(s.start_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        · {fmtDuration(durMs)}
                      </p>
                    </div>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                        reached
                          ? "bg-green-50 text-green-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {reached && <Check className="h-3 w-3" />}
                      {reached ? "Target tercapai" : "Selesai dini"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// ── Tampilan saat ada puasa berjalan ──
function ActiveFast({
  active,
  now,
  busy,
  onEnd,
  onCancel,
}: {
  active: FastingSession;
  now: number;
  busy: boolean;
  onEnd: () => void;
  onCancel: () => void;
}) {
  const startMs = new Date(active.start_at).getTime();
  const targetMs = active.target_hours * HOUR_MS;
  const elapsedMs = now - startMs;
  const remainingMs = targetMs - elapsedMs;
  const reached = remainingMs <= 0;
  const frac = Math.min(1, Math.max(0, elapsedMs / targetMs));
  const projectedEnd = new Date(startMs + targetMs);

  // Lingkaran progress.
  const R = 80;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - frac);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
      <div className="flex flex-col items-center">
        <div className="relative h-52 w-52">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r={R} fill="none" stroke="#e4e4e7" strokeWidth="12" />
            <circle
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke={reached ? "#16a34a" : "#4f46e5"}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={offset}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              {reached ? "Target tercapai" : "Sedang puasa"}
            </span>
            <span className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">
              {fmtDuration(elapsedMs)}
            </span>
            <span className="mt-1 text-xs text-zinc-500">
              {reached
                ? `+${fmtDuration(-remainingMs)} melewati target`
                : `${fmtDuration(remainingMs)} lagi`}
            </span>
          </div>
        </div>

        <div className="mt-4 flex w-full items-center justify-around text-center text-sm">
          <div>
            <p className="text-xs text-zinc-400">Protokol</p>
            <p className="font-semibold text-zinc-900">
              {active.protocol === "custom" ? `${active.target_hours}j` : active.protocol}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Mulai</p>
            <p className="font-semibold text-zinc-900">{fmtClock(new Date(startMs))}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Target selesai</p>
            <p className="font-semibold text-zinc-900">{fmtClock(projectedEnd)}</p>
          </div>
        </div>

        <button
          onClick={onEnd}
          disabled={busy}
          className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-white transition-colors disabled:opacity-50 ${
            reached ? "bg-green-600 hover:bg-green-700" : "bg-zinc-900 hover:bg-zinc-800"
          }`}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="h-5 w-5" />}
          Selesai Puasa
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="mt-2 flex items-center gap-1 text-sm text-zinc-400 hover:text-red-500 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Batalkan
        </button>
      </div>
    </section>
  );
}

// ── Tampilan saat belum ada puasa: pilih protokol & mulai ──
function StartFast({
  protocol,
  setProtocol,
  customHours,
  setCustomHours,
  busy,
  onStart,
}: {
  protocol: FastingProtocol;
  setProtocol: (p: FastingProtocol) => void;
  customHours: number;
  setCustomHours: (h: number) => void;
  busy: boolean;
  onStart: () => void;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white">
          <Hourglass className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-zinc-900">Pilih protokol puasa</p>
          <p className="text-xs text-zinc-500">Timer mulai begitu kamu tekan Mulai</p>
        </div>
      </div>

      <div className="space-y-2">
        {PROTOCOLS.map((p) => (
          <button
            key={p.id}
            onClick={() => setProtocol(p.id)}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
              protocol === p.id
                ? "border-indigo-600 bg-indigo-50"
                : "border-zinc-200 hover:border-zinc-300"
            }`}
          >
            <div>
              <p className="font-semibold text-zinc-900">{p.label}</p>
              <p className="text-xs text-zinc-500">{p.desc}</p>
            </div>
            {protocol === p.id && <Check className="h-5 w-5 text-indigo-600" />}
          </button>
        ))}

        {/* Custom */}
        <button
          onClick={() => setProtocol("custom")}
          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
            protocol === "custom"
              ? "border-indigo-600 bg-indigo-50"
              : "border-zinc-200 hover:border-zinc-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <p className="font-semibold text-zinc-900">Kustom</p>
            {protocol === "custom" && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="number"
                  min={1}
                  max={48}
                  value={customHours}
                  onChange={(e) =>
                    setCustomHours(Math.min(48, Math.max(1, Number(e.target.value) || 1)))
                  }
                  className="w-16 rounded-lg border border-zinc-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <span className="text-sm text-zinc-500">jam</span>
              </div>
            )}
          </div>
          {protocol === "custom" && <Check className="h-5 w-5 text-indigo-600" />}
        </button>
      </div>

      <button
        onClick={onStart}
        disabled={busy}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
        Mulai Puasa
      </button>
    </section>
  );
}
