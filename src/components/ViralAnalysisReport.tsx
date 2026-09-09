import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ViralAnalysisReport as Report } from "@/lib/viral-analysis.functions";

const SECTIONS: { key: keyof Report; label: string }[] = [
  { key: "content_summary", label: "Content Summary" },
  { key: "main_topic", label: "Main Topic" },
  { key: "content_category", label: "Content Category" },
  { key: "storytelling_style", label: "Storytelling Style" },
  { key: "emotional_angle", label: "Emotional Angle" },
  { key: "hook_formula", label: "Hook Formula" },
  { key: "pattern_interrupt", label: "Pattern Interrupt (Rule 1)" },
  { key: "psychological_trigger", label: "Psychological Trigger (Rule 2)" },
  { key: "curiosity_gap", label: "Curiosity Gap (Rule 3)" },
  { key: "power_word", label: "Power Word" },
  { key: "why_this_works", label: "Why This Works" },
  { key: "audience", label: "Audience" },
  { key: "problem", label: "Problem" },
  { key: "solution", label: "Solution" },
  { key: "modification_ideas", label: "Ide Modifikasi (ATM)" },
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1 px-2 text-[11px]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Tidak bisa menyalin teks.");
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Tersalin" : "Salin"}
    </Button>
  );
}

export function ViralAnalysisReportView({ report }: { report: Report }) {
  const full = SECTIONS.map((s) => `${s.label}:\n${String(report[s.key] ?? "")}`).join("\n\n");

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
        <h2 className="font-display text-sm font-semibold">Viral Analysis Report</h2>
        <CopyButton value={full} />
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-2">
        {SECTIONS.map((s) => {
          const value = String(report[s.key] ?? "").trim();
          return (
            <div key={s.key} className="rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  {s.label}
                </p>
                <CopyButton value={value} />
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {value || "—"}
              </p>
            </div>
          );
        })}
      </div>
      <p className="border-t border-border/60 px-5 py-2 text-[11px] text-muted-foreground">
        Analisis formula (ATM: Amati, Tiru konsep, Modifikasi) — bukan salinan caption, naskah,
        atau visual asli.
      </p>
    </div>
  );
}
