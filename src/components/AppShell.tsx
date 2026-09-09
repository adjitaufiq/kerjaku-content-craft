import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Download, Instagram, LayoutGrid, LogOut, Settings2, Wand2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getAccessContext } from "@/lib/roles.functions";
import { useScheduleRunner } from "@/lib/use-schedule-runner";

const nav = [
  { to: "/", label: "Content Grid", icon: LayoutGrid },
  { to: "/editor", label: "Editor & Publisher", icon: Wand2 },
  { to: "/viral", label: "Viral Content Intelligence", icon: Brain },
  { to: "/downloader", label: "Content Downloader", icon: Download },
  { to: "/settings", label: "Settings", icon: Settings2 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  useScheduleRunner();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchAccess = useServerFn(getAccessContext);
  const access = useQuery({
    queryKey: ["access-context"],
    queryFn: () => fetchAccess({}),
    staleTime: 5 * 60_000,
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

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
            {access.data ? (
              <div className="ml-2 flex items-center gap-2 border-l border-border/60 pl-3">
                <span className="hidden text-right text-[11px] leading-tight text-muted-foreground sm:block">
                  {access.data.email ?? "Signed in"}
                  <span className="block text-[10px] text-primary">
                    {access.data.isAdmin ? "Administrator" : "Member"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <LogOut className="size-4" />
                  <span className="sr-only sm:not-sr-only">Sign out</span>
                </button>
              </div>
            ) : null}
          </nav>

        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
