/** Server-only engine: transcript, visual understanding, source report, source lock validation. */

export type TranscriptSegment = { timestamp: string; text: string };
export type SnapshotItem = { path: string; timestamp: string; reason: string };
export type SceneItem = { timestamp: string; scene: string; description: string; objects: string[] };
export type OnScreenTextItem = { timestamp: string; text: string };

/** Bukti teks divalidasi literal; bukti visual tidak pernah dihitung sebagai bukti literal. */
export type EvidenceKind = "text" | "visual";
export type EvidenceVerification =
  | "verified"
  | "rejected"
  | "visual_confirmed"
  | "unverifiable_by_text";

export type Evidence = {
  source_type: "transcript" | "on_screen_text" | "visual";
  timestamp: string;
  quote: string;
  verified?: boolean;
  /** Alasan bila bukti ditolak (kutipan/waktu/frame tidak cocok). */
  reason?: string | undefined;
  evidence_type?: EvidenceKind;
  verification_status?: EvidenceVerification;
};

/** Status informasi pada Source Content Report. */
export type InformationStatus = "verified" | "unverified" | "not_observed";

export type ReportField = {
  value: string;
  evidence: Evidence[];
  verified?: boolean;
  status?: InformationStatus;
};
export type ReportItem = {
  text: string;
  evidence: Evidence[];
  verified?: boolean;
  status?: InformationStatus;
};
export type ToolItem = {
  name: string;
  evidence: Evidence[];
  verified?: boolean;
  status?: InformationStatus;
};


export type SourceReport = {
  summary: ReportField;
  topic: ReportField;
  category: ReportField;
  problem: ReportField;
  solution: ReportField;
  benefit_viewer: ReportField;
  main_information: ReportItem[];
  tools_products: ToolItem[];
  steps_framework: ReportItem[];
};

export const EXTRACTION_MODEL = "openai/gpt-6-astra";

function gatewayError(status: number, detail: string, stage: string): Error {
  if (status === 429) return new Error(`AI sedang sibuk saat ${stage}. Coba lagi sebentar lagi.`);
  if (status === 402)
    return new Error("Kredit AI workspace habis. Tambahkan kredit untuk melanjutkan pemrosesan.");
  if (status === 403)
    return new Error("Akses Lovable AI diblokir oleh kebijakan workspace. Hubungi admin.");
  return new Error(`Gagal ${stage} (${status}). ${detail.slice(0, 240)}`);
}

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY belum tersedia di server.");
  return key;
}

/* ------------------------------------------------------------------ */
/* A. Speech to text                                                   */
/* ------------------------------------------------------------------ */

export async function transcribeChunk(bytes: Uint8Array, filename: string): Promise<string> {
  const form = new FormData();
  form.append("model", "google/gemini-3.5-transcribe");
  form.append("file", new Blob([bytes as unknown as BlobPart], { type: "audio/wav" }), filename);

  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey(), "X-Lovable-AIG-SDK": "fetch" },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw gatewayError(res.status, detail, "mengambil transkrip audio");
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

/* ------------------------------------------------------------------ */
/* Responses API helper (streaming, strict JSON)                       */
/* ------------------------------------------------------------------ */

type ContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" };

async function structuredCall<T>(params: {
  instructions: string;
  content: ContentPart[];
  schemaName: string;
  schema: Record<string, unknown>;
  stage: string;
}): Promise<T> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey(),
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      instructions: params.instructions,
      input: [{ role: "user", content: params.content }],
      stream: true,
      reasoning: { effort: "low", summary: "auto" },
      text: {
        format: {
          type: "json_schema",
          name: params.schemaName,
          strict: true,
          schema: params.schema,
        },
      },
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw gatewayError(res.status, detail, params.stage);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          text += evt.delta;
        } else if (evt.type === "response.completed" && evt.response?.output_text && !text) {
          text = evt.response.output_text;
        }
      } catch {
        /* keep-alive frame */
      }
    }
  }

  if (!text.trim()) throw new Error(`AI tidak mengembalikan hasil saat ${params.stage}.`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Format hasil tidak valid saat ${params.stage}.`);
  }
}

/* ------------------------------------------------------------------ */
/* C + D. Visual understanding & on-screen text (OCR)                  */
/* ------------------------------------------------------------------ */

const VISUAL_INSTRUCTIONS = `Kamu adalah mesin ekstraksi sumber video. Kamu HANYA boleh melaporkan apa yang benar-benar terlihat pada frame.
Larangan keras:
- Dilarang berasumsi, menebak, atau menambah informasi yang tidak terlihat.
- Dilarang membuat ide baru, saran, atau opini.
- Jika frame tidak jelas, tulis apa adanya secara netral.
Untuk teks di layar (on_screen_text): salin PERSIS huruf yang terbaca pada frame. Jika tidak ada teks pada frame, jangan buat entri untuk frame itu.
Jawab dalam Bahasa Indonesia kecuali teks di layar yang harus disalin apa adanya.`;

export async function analyzeFrames(
  frames: Array<{ timestamp: string; dataUrl: string }>,
): Promise<{ scenes: SceneItem[]; on_screen_text: OnScreenTextItem[] }> {
  const content: ContentPart[] = [
    {
      type: "input_text",
      text: [
        "Berikut frame-frame berurutan dari satu video pendek beserta timestamp-nya.",
        "Tugas:",
        "1. scenes: deskripsikan objek, adegan, demonstrasi produk, dan visual storytelling per frame.",
        "2. on_screen_text: salin teks overlay/headline/subtitle yang terbaca, apa adanya.",
        "Gunakan timestamp persis seperti label frame.",
        `Frame: ${frames.map((f) => f.timestamp).join(", ")}`,
      ].join("\n"),
    },
  ];
  for (const frame of frames) {
    content.push({ type: "input_text", text: `Frame ${frame.timestamp}` });
    content.push({ type: "input_image", image_url: frame.dataUrl, detail: "auto" });
  }

  return structuredCall<{ scenes: SceneItem[]; on_screen_text: OnScreenTextItem[] }>({
    instructions: VISUAL_INSTRUCTIONS,
    content,
    schemaName: "visual_understanding",
    stage: "memahami visual video",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["scenes", "on_screen_text"],
      properties: {
        scenes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["timestamp", "scene", "description", "objects"],
            properties: {
              timestamp: { type: "string" },
              scene: { type: "string" },
              description: { type: "string" },
              objects: { type: "array", items: { type: "string" } },
            },
          },
        },
        on_screen_text: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["timestamp", "text"],
            properties: { timestamp: { type: "string" }, text: { type: "string" } },
          },
        },
      },
    },
  });
}

/* ------------------------------------------------------------------ */
/* PART 2. Source Content Report (+ evidence)                          */
/* ------------------------------------------------------------------ */

const REPORT_INSTRUCTIONS = `Kamu adalah mesin ekstraksi Source Content Report. Kamu HANYA boleh menggunakan bahan yang diberikan (transcript, on_screen_text, visual).
Aturan mutlak:
- Dilarang berasumsi atau menambah informasi di luar bahan.
- Dilarang membuat ide, rekomendasi, atau versi baru dari konten.
- Setiap informasi WAJIB punya evidence: source_type (transcript / on_screen_text / visual), timestamp, dan quote.
- quote HARUS potongan kalimat yang disalin PERSIS dari bahan yang diberikan (jangan diparafrase, jangan diterjemahkan).
- Jika sebuah field tidak dapat ditemukan pada bahan, isi value dengan "Tidak ditemukan pada sumber" dan evidence kosong.
- tools_products hanya berisi nama tool/produk yang benar-benar disebut pada transcript atau on_screen_text.
Jawab dalam Bahasa Indonesia, kecuali quote yang disalin apa adanya.`;

const fieldSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value", "evidence"],
  properties: {
    value: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source_type", "timestamp", "quote"],
        properties: {
          source_type: { type: "string", enum: ["transcript", "on_screen_text", "visual"] },
          timestamp: { type: "string" },
          quote: { type: "string" },
        },
      },
    },
  },
} as const;

function listSchema(key: "text" | "name") {
  return {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      required: [key, "evidence"],
      properties: { [key]: { type: "string" }, evidence: fieldSchema.properties.evidence },
    },
  };
}

export async function buildSourceReport(input: {
  transcript: TranscriptSegment[];
  onScreenText: OnScreenTextItem[];
  scenes: SceneItem[];
}): Promise<SourceReport> {
  const material = [
    "== TRANSCRIPT ==",
    input.transcript.length
      ? input.transcript.map((t) => `${t.timestamp} "${t.text}"`).join("\n")
      : "(video tidak memiliki suara / transkrip kosong)",
    "",
    "== ON SCREEN TEXT ==",
    input.onScreenText.length
      ? input.onScreenText.map((t) => `${t.timestamp} "${t.text}"`).join("\n")
      : "(tidak ada teks di layar)",
    "",
    "== VISUAL ==",
    input.scenes.length
      ? input.scenes.map((s) => `${s.timestamp} ${s.scene}: ${s.description}`).join("\n")
      : "(tidak ada data visual)",
  ].join("\n");

  return structuredCall<SourceReport>({
    instructions: REPORT_INSTRUCTIONS,
    content: [
      {
        type: "input_text",
        text: `${material}\n\nBuat Source Content Report berdasarkan bahan di atas saja.`,
      },
    ],
    schemaName: "source_content_report",
    stage: "menyusun Source Content Report",
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "summary",
        "topic",
        "category",
        "problem",
        "solution",
        "benefit_viewer",
        "main_information",
        "tools_products",
        "steps_framework",
      ],
      properties: {
        summary: fieldSchema,
        topic: fieldSchema,
        category: fieldSchema,
        problem: fieldSchema,
        solution: fieldSchema,
        benefit_viewer: fieldSchema,
        main_information: listSchema("text"),
        tools_products: listSchema("name"),
        steps_framework: listSchema("text"),
      },
    },
  });
}

/* ------------------------------------------------------------------ */
/* PART 4. Source Lock Validation (deterministik, quote + timestamp)   */
/* ------------------------------------------------------------------ */

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "01:23" | "00:01:23" | "12" | "12.5s" | "00:10-00:14" -> detik atau null. */
export function parseTimestamp(value: string): number | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const first = raw.split(/[-–—>]/)[0]?.trim() ?? raw;
  const clock = first.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (clock) {
    const a = Number(clock[1]);
    const b = Number(clock[2]);
    const c = clock[3] === undefined ? null : Number(clock[3]);
    return c === null ? a * 60 + b : a * 3600 + b * 60 + c;
  }
  const seconds = first.match(/^(\d+(?:[.,]\d+)?)/);
  if (seconds?.[1]) return Number(seconds[1].replace(",", "."));
  return null;
}

/** Toleransi pembulatan waktu (detik) di luar rentang segmen. */
const TIME_TOLERANCE = 3;

type Segment = { start: number | null; end: number | null; text: string };

function buildSegments(items: Array<{ timestamp: string; text: string }>): Segment[] {
  const parsed = items.map((item) => ({
    start: parseTimestamp(item.timestamp),
    text: normalizeText(item.text ?? ""),
  }));
  return parsed.map((item, index) => {
    const next = parsed.slice(index + 1).find((p) => p.start !== null);
    return { start: item.start, end: next?.start ?? null, text: item.text };
  });
}

function withinSegment(segment: Segment, at: number): boolean {
  if (segment.start === null) return true;
  const start = segment.start - TIME_TOLERANCE;
  // Segmen berikutnya menutup segmen ini (eksklusif) supaya waktu tidak saling tumpang tindih.
  if (segment.end !== null) return at >= start && at < segment.end;
  return at >= start && at <= segment.start + 30 + TIME_TOLERANCE;
}

export type EvidenceCheckMaterial = {
  transcript: TranscriptSegment[];
  onScreenText: OnScreenTextItem[];
  scenes: SceneItem[];
  snapshots?: SnapshotItem[];
};

/** Nilai yang dianggap "tidak teramati" pada sumber. */
const EMPTY_PATTERNS =
  /^(tidak ditemukan|tidak ada|tidak diketahui|tidak disebut|belum ditemukan|unknown|none|n\/?a|-)\b/i;

export function isNotObserved(value: string): boolean {
  const text = (value ?? "").trim();
  return !text || EMPTY_PATTERNS.test(text);
}

export type ValidationScores = {
  /** Bukti teks terverifikasi / bukti teks diperiksa. */
  report_confidence: number;
  /** Kualitas bahan mentah: transkrip + cakupan frame. */
  source_confidence: number;
  /** Sebaran frame + ketersediaan audio. */
  coverage_score: number;
  /** Informasi teramati / total slot informasi. */
  completeness_score: number;
};

export function validateReport(
  report: SourceReport,
  material: EvidenceCheckMaterial,
): {
  report: SourceReport;
  verification_status: "completed" | "partial" | "needs_review" | "failed";
  confidence_score: number;
  checked: number;
  verified: number;
  scores: ValidationScores;
} {
  const segments: Record<Evidence["source_type"], Segment[]> = {
    transcript: buildSegments(material.transcript ?? []),
    on_screen_text: buildSegments(material.onScreenText ?? []),
    visual: buildSegments(
      (material.scenes ?? []).map((s) => ({
        timestamp: s.timestamp,
        text: `${s.scene} ${s.description} ${(s.objects ?? []).join(" ")}`,
      })),
    ),
  };

  const frameTimes = (material.snapshots ?? [])
    .map((s) => parseTimestamp(s.timestamp))
    .filter((t): t is number => t !== null);
  const sceneTimes = (material.scenes ?? [])
    .map((s) => parseTimestamp(s.timestamp))
    .filter((t): t is number => t !== null);
  const knownFrameTimes = frameTimes.length ? frameTimes : sceneTimes;

  const textCorpus = normalizeText(
    [
      ...(material.transcript ?? []).map((t) => t.text),
      ...(material.onScreenText ?? []).map((t) => t.text),
    ].join(" "),
  );

  /**
   * Bukti visual TIDAK PERNAH dihitung sebagai bukti literal: deskripsi visual
   * dibuat oleh AI, sehingga mencocokkannya ke deskripsi itu sendiri berarti AI
   * memvalidasi dirinya sendiri. Bukti visual hanya dicek keberadaan frame-nya.
   */
  const checkVisual = (ev: Evidence): Evidence => {
    const at = parseTimestamp(ev.timestamp ?? "");
    const frameExists = at !== null && knownFrameTimes.some((t) => Math.abs(t - at) <= TIME_TOLERANCE);
    return {
      ...ev,
      evidence_type: "visual",
      verified: false,
      verification_status: frameExists ? "visual_confirmed" : "unverifiable_by_text",
      reason: frameExists
        ? "Bukti visual: frame tersedia, tidak dihitung sebagai bukti literal."
        : "Bukti visual tanpa frame video pada waktu tersebut.",
    };
  };

  const checkText = (ev: Evidence): Evidence => {
    const quote = normalizeText(ev.quote ?? "");
    const list = segments[ev.source_type] ?? [];
    const at = parseTimestamp(ev.timestamp ?? "");
    const rejected = (reason: string): Evidence => ({
      ...ev,
      evidence_type: "text",
      verified: false,
      verification_status: "rejected",
      reason,
    });

    if (!quote) return rejected("Kutipan kosong.");
    if (!list.length) return rejected("Sumber bukti tidak tersedia pada ekstraksi.");
    if (!list.some((seg) => seg.text.includes(quote))) {
      return rejected("Kutipan tidak ditemukan pada sumber (kemungkinan parafrase).");
    }
    if (at === null) return rejected("Timestamp bukti tidak valid.");
    if (!list.some((seg) => withinSegment(seg, at) && seg.text.includes(quote))) {
      return rejected("Kutipan ada, tetapi bukan pada waktu tersebut.");
    }
    return {
      ...ev,
      evidence_type: "text",
      verified: true,
      verification_status: "verified",
      reason: undefined,
    };
  };

  const checkOne = (ev: Evidence): Evidence =>
    ev.source_type === "visual" ? checkVisual(ev) : checkText(ev);

  let checked = 0; // klaim teramati yang diperiksa
  let verified = 0; // klaim dengan bukti teks lolos
  let slots = 0; // total slot informasi
  let observed = 0; // slot yang benar-benar berisi informasi

  const checkEvidence = (evidence: Evidence[]) => {
    const list = (evidence ?? []).map(checkOne);
    const textEvidence = list.filter((ev) => ev.evidence_type === "text");
    return {
      evidence: list,
      // Minimal satu bukti teks, dan seluruh bukti teks harus lolos.
      verified: textEvidence.length > 0 && textEvidence.every((ev) => ev.verified),
    };
  };

  const statusOf = (ok: boolean): InformationStatus => (ok ? "verified" : "unverified");

  const checkField = (field: ReportField): ReportField => {
    slots += 1;
    const value = (field?.value ?? "").trim();
    if (isNotObserved(value)) {
      // Informasi kosong TIDAK dianggap terverifikasi.
      return {
        value: value || "Tidak ditemukan pada sumber",
        evidence: [],
        verified: false,
        status: "not_observed",
      };
    }
    observed += 1;
    checked += 1;
    const res = checkEvidence(field.evidence ?? []);
    if (res.verified) verified += 1;
    return { value, evidence: res.evidence, verified: res.verified, status: statusOf(res.verified) };
  };

  const checkItems = (items: ReportItem[]): ReportItem[] =>
    (items ?? []).map((item) => {
      slots += 1;
      const text = (item.text ?? "").trim();
      if (isNotObserved(text)) {
        return { text, evidence: [], verified: false, status: "not_observed" };
      }
      observed += 1;
      checked += 1;
      const res = checkEvidence(item.evidence ?? []);
      if (res.verified) verified += 1;
      return { text, evidence: res.evidence, verified: res.verified, status: statusOf(res.verified) };
    });

  // Tools/product harus benar-benar disebut pada transcript atau teks di layar.
  const checkTools = (items: ToolItem[]): ToolItem[] =>
    (items ?? []).map((item) => {
      slots += 1;
      const rawName = (item.name ?? "").trim();
      if (isNotObserved(rawName)) {
        return { name: rawName, evidence: [], verified: false, status: "not_observed" };
      }
      observed += 1;
      checked += 1;
      const name = normalizeText(rawName);
      const mentioned = name.length > 0 && textCorpus.includes(name);
      const res = checkEvidence(item.evidence ?? []);
      const ok = mentioned && res.verified;
      if (ok) verified += 1;
      const evidence = mentioned
        ? res.evidence
        : res.evidence.map((ev) => ({
            ...ev,
            verified: false,
            verification_status: "rejected" as EvidenceVerification,
            reason: ev.reason ?? "Nama tool/produk tidak disebut pada transkrip atau teks di layar.",
          }));
      return { name: rawName, evidence, verified: ok, status: statusOf(ok) };
    });

  const validated: SourceReport = {
    summary: checkField(report.summary),
    topic: checkField(report.topic),
    category: checkField(report.category),
    problem: checkField(report.problem),
    solution: checkField(report.solution),
    benefit_viewer: checkField(report.benefit_viewer),
    main_information: checkItems(report.main_information),
    tools_products: checkTools(report.tools_products),
    steps_framework: checkItems(report.steps_framework),
  };

  const pct = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

  const reportConfidence = checked === 0 ? 0 : pct((verified / checked) * 100);
  const completeness = slots === 0 ? 0 : pct((observed / slots) * 100);

  // Coverage: ketersediaan audio + sebaran frame (8 frame dianggap cakupan penuh).
  const transcriptSegments = (material.transcript ?? []).filter((t) => (t.text ?? "").trim()).length;
  const frameCoverage = Math.min(1, knownFrameTimes.length / 8);
  const audioCoverage = transcriptSegments > 0 ? Math.min(1, transcriptSegments / 4) : 0;
  const coverage = pct((frameCoverage * 0.5 + audioCoverage * 0.5) * 100);

  // Source confidence: mutu bahan mentah (coverage + kelengkapan informasi teramati).
  const sourceConfidence = pct(coverage * 0.6 + completeness * 0.4);

  // Satu standar ambang: >=70 siap, 50-69 sebagian, <50 perlu ditinjau.
  const status: "completed" | "partial" | "needs_review" | "failed" =
    checked === 0
      ? "needs_review"
      : verified === 0
        ? "failed"
        : reportConfidence >= 90 && completeness >= 70
          ? "completed"
          : reportConfidence >= 50
            ? "partial"
            : "needs_review";

  return {
    report: validated,
    verification_status: status,
    confidence_score: reportConfidence,
    checked,
    verified,
    scores: {
      report_confidence: reportConfidence,
      source_confidence: sourceConfidence,
      coverage_score: coverage,
      completeness_score: completeness,
    },
  };
}
