import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Instagram,
  LayoutGrid,
  LogOut,
  Settings2,
  Video,
  Wand2,
  Factory,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getAccessContext } from "@/lib/roles.functions";
import { useScheduleRunner } from "@/lib/use-schedule-runner";

const nav = [
  { to: "/factory", label: "Factory", icon: Factory },
  { to: "/", label: "Grid", icon: LayoutGrid },
  { to: "/editor", label: "Editor", icon: Wand2 },
  { to: "/sources", label: "Cliper", icon: Video },
  { to: "/settings", label: "Settings", icon: Settings2 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  useScheduleRunner();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
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

          <nav className="flex w-full min-w-0 items-center gap-1 overflow-x-auto lg:ml-auto lg:w-auto">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={
                  item.to === "/sources" && pathname === "/source-detail" ? "page" : undefined
                }
                data-workspace-active={
                  item.to === "/sources" && pathname === "/source-detail" ? "true" : undefined
                }
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground ${
                  item.to === "/sources" && pathname === "/source-detail"
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground"
                }`}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void signOut()}
                  className="gap-1.5 text-muted-foreground"
                >
                  <LogOut className="size-4" />
                  <span className="sr-only sm:not-sr-only">Sign out</span>
                </Button>
              </div>
            ) : null}
          </nav>

        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
