import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, KeyRound, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useMetaTokenStatus } from "@/lib/use-schedule-runner";
import { saveBank, type BankRow } from "@/lib/content-data";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Config — KERJAKU Instagram Publisher" },
      {
        name: "description",
        content:
          "Pantau masa berlaku Meta access token server-side dan unggah file Excel bank konten KERJAKU.",
      },
      { property: "og:title", content: "Settings & Config — KERJAKU Instagram Publisher" },
      {
        property: "og:description",
        content: "Monitoring token Meta Graph API dan impor bank konten dari Excel.",
      },
    ],
  }),
  component: SettingsPage,
});

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID");
}

function SettingsPage() {
  const tokenStatus = useMetaTokenStatus();
  const status = tokenStatus.data;
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();



  async function handleFile(file: File) {
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheetName = wb.SheetNames[0]!;
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]!, {
        defval: "",
      });

      const rows: BankRow[] = [];
      for (const raw of json) {
        const entries = Object.entries(raw);
        const pick = (needle: string) =>
          String(
            entries.find(([k]) => k.toLowerCase().includes(needle))?.[1] ?? "",
          ).trim();
        const no = Number(pick("no"));
        if (!Number.isFinite(no) || no <= 0) continue;
        rows.push({
          no,
          title: pick("judul"),
          prompt: pick("prompt"),
          caption: pick("caption"),
        });
      }

      if (!rows.length) throw new Error("Tidak ada baris valid ditemukan di file Excel.");
      await saveBank(rows);
      await queryClient.invalidateQueries({ queryKey: ["bank"] });
      toast.success(`${rows.length} konten berhasil diimpor.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membaca file Excel.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-bold">Settings & Config</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Kredensial Meta disimpan lokal di browser ini dan hanya dikirim saat publish.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="surface-panel p-6">
          <div className="flex items-center gap-2 text-primary">
            <KeyRound className="size-4" />
            <h2 className="text-base font-semibold text-foreground">Meta Graph API</h2>
          </div>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ig-id">Instagram Business Account ID</Label>
              <Input
                id="ig-id"
                placeholder="17841400000000000"
                value={idValue}
                onChange={(e) => setIgAccountId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ig-token">Meta Long-Lived Access Token</Label>
              <Input
                id="ig-token"
                type="password"
                placeholder="EAAG..."
                value={tokenValue}
                onChange={(e) => setAccessToken(e.target.value)}
              />
            </div>
            <Button
              onClick={() => {
                save({ igAccountId: idValue.trim(), accessToken: tokenValue.trim() });
                toast.success("Konfigurasi tersimpan.");
              }}
            >
              Simpan Konfigurasi
            </Button>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-accent" />
              {configured ? "Kredensial aktif." : "Belum dikonfigurasi."}
            </p>
          </div>
        </section>

        <section className="surface-panel p-6">
          <div className="flex items-center gap-2 text-accent">
            <FileSpreadsheet className="size-4" />
            <h2 className="text-base font-semibold text-foreground">Bank Konten (Excel)</h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Unggah <code className="text-foreground">Bank_Konten_KERJAKU_1-30_LOCKED.xlsx</code>{" "}
            dengan kolom No, Judul / Alur Konten, Prompt Generate Foto, dan Caption.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button
            variant="secondary"
            className="mt-5"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? "Memproses…" : "Upload File Excel"}
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
