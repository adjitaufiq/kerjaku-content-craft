import { Check, LockKeyhole } from "lucide-react";

const STEPS = [
  "Source",
  "Analysis",
  "ATM KERJAKU",
  "Hook Matrix",
  "Selected Concept",
  "Output Prompt",
] as const;

export type CliperStep = (typeof STEPS)[number];

export function CliperWorkspaceSteps({ current }: { current: CliperStep }) {
  const currentIndex = STEPS.indexOf(current);

  return (
    <section aria-label="Tahapan Cliper" className="overflow-x-auto border-y border-border py-3">
      <ol className="flex min-w-max items-center gap-2">
        {STEPS.map((step, index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;
          const locked = step === "Output Prompt";
          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${
                active
                  ? "bg-primary/15 text-primary"
                  : complete
                    ? "text-accent"
                    : "text-muted-foreground"
              }`}
            >
              <span className="flex size-5 items-center justify-center rounded-full border border-current/40 text-[10px]">
                {complete ? <Check className="size-3" /> : locked ? <LockKeyhole className="size-3" /> : index + 1}
              </span>
              {step}
            </li>
          );
        })}
      </ol>
    </section>
  );
}