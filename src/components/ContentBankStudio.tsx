import { useRef, useState } from "react";
import {
  Copy,
  Download,
  History,
  LockKeyhole,
  Save,
  Search,
  Upload,
  ArrowRight,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CONTENT_CATEGORIES,
  WORKFLOW_STATUSES,
  contentSchema,
  prepareBankImport,
  filterContents,
  forkContent,
  reviseContent,
  systemTemplates,
  validateStatusTransition,
  type BankContent,
} from "@/lib/content-bank";
import { importContentWorkbook, exportContentWorkbook } from "@/lib/content-bank-excel";

function downloadWorkbook(rows: BankContent[]) {
  const bytes = exportContentWorkbook(rows, {
    stressTest: rows.some((r) => r.classification === "PERSONAL_CONTENT"),
  });
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "Bank_Konten_KERJAKU_Production.xlsx";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fields = [
  ["hook", "Hook 3 Detik"],
  ["script", "Script"],
  ["scenes", "Scene Breakdown"],
  ["visualDirection", "Visual Direction"],
  ["voiceOver", "Voice Over"],
  ["cta", "CTA"],
  ["hashtags", "Hashtags"],
  ["thumbnailText", "Thumbnail Text"],
] as const;

export function ContentBankStudio({
  drafts,
  onChange,
  onSync,
  onProduce,
  saving,
}: {
  drafts: BankContent[];
  onChange: (rows: BankContent[]) => void;
  onSync: (rows: BankContent[]) => Promise<void>;
  onProduce: (rows: BankContent[]) => void;
  saving: boolean;
}) {
  const [scope, setScope] = useState("templates");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<BankContent | null>(null);
  const [history, setHistory] = useState<BankContent | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const templates = systemTemplates();
  const rows = filterContents(scope === "templates" ? templates : drafts, search, category, status);
  const nextNo = () => Math.max(30, ...drafts.map((r) => r.no)) + 1;
  function duplicate(row: BankContent) {
    const copy = forkContent(row, nextNo());
    onChange([...drafts, copy]);
    setScope("drafts");
    setEditing(copy);
  }
  async function importFile(file: File) {
    try {
      const imported = importContentWorkbook(await file.arrayBuffer());
      const fresh = prepareBankImport(imported, drafts);
      // Imported ID/status cannot update an existing or published row implicitly.
      onChange([...drafts, ...fresh]);
      setScope("drafts");
      toast.success(
        `${fresh.length} draf diimpor; ${imported.length - fresh.length} template sistem tidak ditimpa.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impor gagal.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }
  function saveEdit() {
    if (!editing) return;
    const current = drafts.find((r) => r.id === editing.id);
    if (!current) return;
    try {
      validateStatusTransition(current, editing.status);
      const result = reviseContent(current, editing);
      onChange(drafts.map((r) => (r.id === result.id ? result : r)));
      setEditing(null);
      toast.success("Versi draf tersimpan di perangkat.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan.");
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 border-b border-border">
          <Button
            variant="ghost"
            className={scope === "templates" ? "text-primary" : "text-muted-foreground"}
            onClick={() => {
              setScope("templates");
              setSelected([]);
            }}
          >
            Template sistem{" "}
            <Badge variant="secondary" className="ml-2">
              30
            </Badge>
          </Button>
          <Button
            variant="ghost"
            className={scope === "drafts" ? "text-primary" : "text-muted-foreground"}
            onClick={() => {
              setScope("drafts");
              setSelected([]);
            }}
          >
            Konten saya{" "}
            <Badge variant="secondary" className="ml-2">
              {drafts.length}
            </Badge>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            aria-label="Import Excel"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
            }}
          />
          <Button variant="outline" onClick={() => input.current?.click()}>
            <Upload className="size-4" />
            Import XLSX
          </Button>
          <Button
            variant="outline"
            disabled={!rows.length}
            onClick={() => {
              try {
                downloadWorkbook(
                  selected.length ? rows.filter((r) => selected.includes(r.id)) : rows,
                );
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Export gagal");
              }
            }}
          >
            <Download className="size-4" />
            Export XLSX
          </Button>
          <Button
            onClick={() => {
              const row = contentSchema.parse({
                id: crypto.randomUUID(),
                no: nextNo(),
                title: "Konten baru",
                prompt: "",
                caption: "",
                classification: "PERSONAL_CONTENT",
                production: {},
              });
              onChange([...drafts, row]);
              setScope("drafts");
              setEditing(row);
            }}
          >
            <Plus className="size-4" />
            Konten
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_210px_160px]">
        <div className="relative">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Cari konten"
            placeholder="Cari judul, script, tag…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger aria-label="Filter kategori">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kategori</SelectItem>
            {CONTENT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filter status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {WORKFLOW_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {scope === "drafts" && drafts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {selected.length ? `${selected.length} dipilih` : `${rows.length} konten`} · Draf
            perangkat
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() =>
                void onSync(
                  selected.length ? drafts.filter((r) => selected.includes(r.id)) : drafts,
                )
              }
            >
              <Save className="size-4" />
              {saving ? "Menyimpan…" : "Simpan ke Cloud"}
            </Button>
            <Button
              disabled={!selected.length}
              onClick={() => onProduce(drafts.filter((d) => selected.includes(d.id)))}
            >
              <ArrowRight className="size-4" />
              Produksi pilihan
            </Button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto border-y border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="w-10 p-3">
                <span className="sr-only">Pilih</span>
              </th>
              <th className="w-16 p-3">No</th>
              <th className="min-w-64 p-3">Judul / Alur Konten</th>
              <th className="p-3">Kategori</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/60 hover:bg-muted/30">
                <td className="p-3">
                  <input
                    type="checkbox"
                    aria-label={`Pilih konten ${r.no}`}
                    checked={selected.includes(r.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, r.id]
                          : selected.filter((id) => id !== r.id),
                      )
                    }
                  />
                </td>
                <td className="p-3 font-display text-primary">{r.no}</td>
                <td className="p-3">
                  <div className="font-medium">{r.title}</div>
                  <div className="mt-1 line-clamp-1 max-w-md text-xs text-muted-foreground">
                    {r.caption}
                  </div>
                  {r.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <Badge key={t} variant="outline">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>
                <td className="p-3 whitespace-nowrap text-xs">{r.production.category}</td>
                <td className="p-3">
                  <Badge variant="secondary">
                    {r.classification === "SYSTEM_TEMPLATE" ? (
                      <>
                        <LockKeyhole className="mr-1 size-3" />
                        Sistem
                      </>
                    ) : (
                      r.status
                    )}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    {r.classification !== "SYSTEM_TEMPLATE" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={r.status === "published" || r.status === "scheduled"}
                          onClick={() => setEditing(r)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Riwayat versi"
                          aria-label={`Riwayat ${r.no}`}
                          onClick={() => setHistory(r)}
                        >
                          <History className="size-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Buat salinan pribadi"
                      aria-label={`Duplikat konten ${r.no}`}
                      onClick={() => duplicate(r)}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Lanjut ke produksi"
                      aria-label={`Produksi konten ${r.no}`}
                      onClick={() => onProduce([r])}
                    >
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-8 text-center text-muted-foreground">Belum ada konten yang cocok.</p>
        )}
      </div>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Script produksi · #{editing?.no}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="bank-title">Judul / Alur Konten</Label>
                <Input
                  id="bank-title"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Kategori</Label>
                  <Select
                    value={editing.production.category}
                    onValueChange={(v) =>
                      setEditing({
                        ...editing,
                        production: {
                          ...editing.production,
                          category: CONTENT_CATEGORIES.find((c) => c === v) ?? "Educational",
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={editing.status}
                    onValueChange={(v) =>
                      setEditing({ ...editing, status: v === "approved" ? "approved" : "draft" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">draft</SelectItem>
                      <SelectItem value="approved">approved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Target Audiens</Label>
                  <Input
                    value={editing.production.audience}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        production: { ...editing.production, audience: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Platform</Label>
                  <Input
                    value={editing.production.platform}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        production: { ...editing.production, platform: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Format</Label>
                  <Select
                    value={editing.production.format}
                    onValueChange={(v) =>
                      setEditing({
                        ...editing,
                        production: {
                          ...editing.production,
                          format: v === "Foto" || v === "Carousel" ? v : "Video",
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Video", "Foto", "Carousel"].map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Durasi (detik)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing.production.duration}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        production: {
                          ...editing.production,
                          duration: Math.max(0, Number(e.target.value)),
                        },
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Subkategori</Label>
                  <Input
                    value={editing.subcategory}
                    onChange={(e) => setEditing({ ...editing, subcategory: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tags</Label>
                  <Input
                    value={editing.tags.join(", ")}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        tags: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Prompt Generate Foto</Label>
                <Textarea
                  rows={4}
                  value={editing.prompt}
                  onChange={(e) => setEditing({ ...editing, prompt: e.target.value })}
                />
              </div>
              {fields.map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Textarea
                    rows={key === "script" || key === "scenes" ? 5 : 2}
                    value={editing.production[key]}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        production: { ...editing.production, [key]: e.target.value },
                      })
                    }
                  />
                </div>
              ))}
              <div>
                <Label>Caption</Label>
                <Textarea
                  rows={4}
                  value={editing.caption}
                  onChange={(e) => setEditing({ ...editing, caption: e.target.value })}
                />
              </div>
              <Button className="w-full" onClick={saveEdit}>
                <Save className="size-4" />
                Simpan versi
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(history)}
        onOpenChange={(open) => {
          if (!open) setHistory(null);
        }}
      >
        <DialogContent className="max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Riwayat versi · #{history?.no}</DialogTitle>
          </DialogHeader>
          <p className="text-sm">Versi saat ini: {history?.revision}</p>
          {history?.history.length ? (
            history.history.map((entry) => (
              <details key={entry.revision} className="border-t border-border py-3">
                <summary className="cursor-pointer text-sm">
                  Versi {entry.revision} · {new Date(entry.at).toLocaleString("id-ID")}
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-all text-xs text-muted-foreground">
                  {JSON.stringify(JSON.parse(entry.snapshot), null, 2)}
                </pre>
              </details>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada revisi.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
