import { Check, Loader2 } from "lucide-react";

import { PROGRESS_STEPS, type PipelineStage } from "@/lib/video-understanding.functions";

/** Progres analisis: Video → Audio → Transcript → OCR → Snapshot → Scene → Viral DNA. */
export function ExtractionProgress({
  stage,
  running,
}: {
  stage: PipelineStage | "";
  running: boolean;
}) {
  const activeIndex = PROGRESS_STEPS.findIndex((step) =>
    (step.stages as readonly string[]).includes(stage),
  );

  return (
    <div className="surface-panel flex flex-wrap items-center gap-2 p-4 text-xs">
      {PROGRESS_STEPS.map((step, index) => {
        const done = activeIndex > index || stage === "COMPLETED";
        const active = activeIndex === index && stage !== "COMPLETED";
        return (
          <div key={step.key} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                done
                  ? "bg-accent/15 text-accent"
                  : active
                    ? "bg-primary/15 text-primary"
                    : "bg-secondary/60 text-muted-foreground"
              }`}
            >
              {done ? (
                <Check className="size-3" />
              ) : active && running ? (
                <Loader2 className="size-3 animate-spin" />
              ) : null}
              {step.label}
            </span>
            {index < PROGRESS_STEPS.length - 1 ? (
              <span className="text-muted-foreground">›</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
