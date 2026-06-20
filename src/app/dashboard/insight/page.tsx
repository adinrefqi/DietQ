// Insight AI Mingguan — analisis nutrisi 7 hari oleh LLM (arkoda)
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InsightClient } from "./client";

export default async function InsightPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return <InsightClient />;
}
