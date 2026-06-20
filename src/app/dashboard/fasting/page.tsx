// Intermittent Fasting — timer puasa berjendela
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FastingSession } from "@/types/database";
import { FastingClient } from "./client";

export default async function FastingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Sesi aktif (end_at NULL) — paling banyak satu (dijaga unique index).
  const { data: active } = await supabase
    .from("fasting_sessions")
    .select("*")
    .eq("user_id", user.id)
    .is("end_at", null)
    .maybeSingle();

  // Riwayat puasa yang sudah selesai.
  const { data: history } = await supabase
    .from("fasting_sessions")
    .select("*")
    .eq("user_id", user.id)
    .not("end_at", "is", null)
    .order("start_at", { ascending: false })
    .limit(10);

  return (
    <FastingClient
      active={(active as FastingSession | null) ?? null}
      history={(history as FastingSession[] | null) ?? []}
    />
  );
}
