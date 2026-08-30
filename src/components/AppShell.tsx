import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Instagram, LayoutGrid, Settings2, Wand2 } from "lucide-react";

import { useScheduleRunner } from "@/lib/use-schedule-runner";

const nav = [
  { to: "/", label: "Content Grid", icon: LayoutGrid },
  { to: "/editor", label: "Editor & Publisher", icon: Wand2 },
  { to: "/settings", label: "Settings", icon: Settings2 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  useScheduleRunner();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary glow-ring">
              <Instagram className="size-4.5" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-sm font-bold tracking-tight">
                KERJAKU <span className="brand-text">Publisher</span>
              </span>
              <span className="block text-[11px] text-muted-foreground">@kerjaku.space</span>
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-primary/12 text-primary" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
