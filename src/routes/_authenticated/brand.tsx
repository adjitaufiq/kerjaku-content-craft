import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { BrandCenter } from "@/components/BrandCenter";

export const Route = createFileRoute("/_authenticated/brand")({
  head: () => ({
    meta: [
      { title: "Brand Center — KERJAKU Publisher" },
      {
        name: "description",
        content:
          "Kelola profil brand, produk, aturan, dan power words KERJAKU sebagai sumber fakta ATM Engine.",
      },
      { property: "og:title", content: "Brand Center — KERJAKU Publisher" },
      {
        property: "og:description",
        content: "Brand Knowledge terpusat dengan skor kesiapan untuk Creative ATM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrandPage,
});

function BrandPage() {
  return (
    <AppShell>
      <BrandCenter />
    </AppShell>
  );
}
