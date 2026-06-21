"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  PlusCircle,
  Scale,
  History,
  Hourglass,
  Sparkles,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Home", exact: true },
  { href: "/dashboard/log", icon: PlusCircle, label: "Log" },
  { href: "/dashboard/weight", icon: Scale, label: "Berat" },
  { href: "/dashboard/history", icon: History, label: "Riwayat" },
  { href: "/dashboard/fasting", icon: Hourglass, label: "Puasa" },
  { href: "/dashboard/insight", icon: Sparkles, label: "Insight" },
];

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href || pathname === `${href}/`;
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-zinc-950/80 transition-all"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="mx-auto flex max-w-lg items-center justify-around px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex flex-col items-center gap-0.5 px-2 py-2.5 transition-all duration-200 ${
                active
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400"
              }`}
            >
              <Icon
                className={`h-5 w-5 transition-all duration-200 ${
                  active
                    ? "scale-110 drop-shadow-sm"
                    : "scale-100 group-hover:scale-105"
                }`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className={`text-[10px] font-semibold transition-all duration-200 ${
                active ? "opacity-100 -translate-y-0.5" : "opacity-70 group-hover:opacity-100"
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
