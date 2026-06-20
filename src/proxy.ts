// Next.js 16 Proxy (dulu "middleware") — refresh sesi Supabase tiap request.
// Konvensi `middleware` di-deprecate & di-rename jadi `proxy` (Next 16).
import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip static files, Next.js internals, dan aset PWA (sw.js, manifest)
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
