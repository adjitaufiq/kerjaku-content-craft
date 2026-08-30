import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Instagram } from "lucide-react";

import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign In — KERJAKU Instagram Publisher" },
      {
        name: "description",
        content:
          "Masuk dengan akun Google untuk mengelola konten dan koneksi Instagram @kerjaku.space.",
      },
      { property: "og:title", content: "Sign In — KERJAKU Instagram Publisher" },
      {
        property: "og:description",
        content: "Akses internal KERJAKU Instagram Publisher.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function signIn() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Gagal masuk dengan Google.");
        return;
      }
      if (result.redirected) return;
      await navigate({ to: "/", replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="surface-panel w-full max-w-sm p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary glow-ring">
          <Instagram className="size-6" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold">
          KERJAKU <span className="brand-text">Publisher</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Aplikasi internal @kerjaku.space. Masuk untuk melanjutkan.
        </p>
        <Button className="mt-6 w-full" disabled={busy} onClick={() => void signIn()}>
          {busy ? "Menghubungkan…" : "Masuk dengan Google"}
        </Button>
      </div>
    </main>
  );
}
