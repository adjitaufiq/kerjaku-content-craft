import * as XLSX from "xlsx";
import {
  BANK_HEADERS,
  SCRIPT_HEADERS,
  contentSchema,
  isExactTemplate,
  type BankContent,
} from "./content-bank";

function text(value: unknown): string {
  return value == null ? "" : String(value);
}
function table(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: true,
  });
}
function requireHeaders(actual: unknown[], expected: readonly string[], name: string) {
  if (
    expected.some((h, i) => actual[i] !== h) ||
    (name !== "BANK KONTEN" && actual.length > expected.length)
  )
    throw new Error(
      `${name}: urutan kolom wajib ${expected.join(", ")}. Tidak ada kolom yang dibuang diam-diam.`,
    );
}
function validateNumbers(rows: BankContent[]) {
  if (new Set(rows.map((r) => r.no)).size !== rows.length)
    throw new Error("Nomor konten ganda: pisahkan nomor sebelum menautkan dua sheet.");
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw new Error("Content ID ganda dalam workbook.");
}
export function exportContentWorkbook(rows: BankContent[]): Uint8Array {
  validateNumbers(rows);
  const wb = XLSX.utils.book_new();
  const bank = XLSX.utils.aoa_to_sheet([
    Array.from(BANK_HEADERS),
    ...rows.map((r) => [r.no, r.title, r.prompt, r.caption]),
  ]);
  const scripts = XLSX.utils.aoa_to_sheet([
    Array.from(SCRIPT_HEADERS),
    ...rows.map((r) => {
      const p = r.production;
      return [
        r.id,
        r.no,
        p.category,
        p.audience,
        p.platform,
        p.format,
        p.hook,
        p.script,
        p.scenes,
        p.visualDirection,
        p.voiceOver,
        p.cta,
        p.hashtags,
        p.thumbnailText,
        p.duration,
        r.status,
      ];
    }),
  ]);
  rows.forEach((r, i) => {
    const cell = scripts[`A${i + 2}`];
    if (cell)
      cell.c = [
        {
          a: "KERJAKU",
          t: JSON.stringify({
            version: 1,
            classification: r.classification,
            tags: r.tags,
            subcategory: r.subcategory,
            legacyCells: r.legacyCells,
            revision: r.revision,
            history: r.history,
          }),
        },
      ];
  });
  bank["!cols"] = [{ wch: 8 }, { wch: 45 }, { wch: 85 }, { wch: 70 }];
  scripts["!cols"] = SCRIPT_HEADERS.map((_, i) => ({
    wch: i === 0 ? 38 : i >= 6 && i <= 10 ? 65 : 24,
  }));
  bank["!autofilter"] = { ref: `A1:D${Math.max(1, rows.length + 1)}` };
  scripts["!autofilter"] = { ref: `A1:P${Math.max(1, rows.length + 1)}` };
  XLSX.utils.book_append_sheet(wb, bank, "BANK KONTEN");
  XLSX.utils.book_append_sheet(wb, scripts, "PRODUCTION SCRIPT");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}
export function importContentWorkbook(buffer: ArrayBuffer | Uint8Array): BankContent[] {
  const wb = XLSX.read(buffer, { type: "array", cellFormula: true });
  const name = wb.Sheets["BANK KONTEN"] ? "BANK KONTEN" : wb.SheetNames[0];
  const bank = name ? wb.Sheets[name] : undefined;
  if (!bank) throw new Error("Workbook tidak memiliki BANK KONTEN.");
  const rows = table(bank);
  const headers = rows.shift();
  if (!headers) throw new Error("Workbook kosong.");
  requireHeaders(headers, BANK_HEADERS, "BANK KONTEN");
  const scriptSheet = wb.Sheets["PRODUCTION SCRIPT"];
  const productionRows = scriptSheet ? table(scriptSheet) : [];
  if (scriptSheet) {
    const h = productionRows.shift();
    if (!h) throw new Error("PRODUCTION SCRIPT kosong.");
    requireHeaders(h, SCRIPT_HEADERS, "PRODUCTION SCRIPT");
  }
  const byNo = new Map<number, { values: unknown[]; index: number }>();
  productionRows.forEach((r, index) => {
    const no = Number(r[1]);
    if (byNo.has(no)) throw new Error("Nomor ganda pada PRODUCTION SCRIPT.");
    byNo.set(no, { values: r, index });
  });
  // Formula results are not a lossless content representation; reject rather than flatten silently.
  for (const sheet of [bank, ...(scriptSheet ? [scriptSheet] : [])])
    for (const [key, value] of Object.entries(sheet)) {
      if (!key.startsWith("!") && value && typeof value === "object" && "f" in value)
        throw new Error(
          `Formula ${key} tidak dapat diimpor sebagai teks konten; gunakan nilai teks.`,
        );
    }
  const result = rows.map((r): BankContent => {
    const no = Number(r[0]);
    const entry = byNo.get(no);
    const p = entry?.values;
    let meta: unknown = {};
    const comment =
      entry && scriptSheet
        ? scriptSheet[`A${entry.index + 2}`]?.c?.find((c: XLSX.Comment) => c.a === "KERJAKU")?.t
        : undefined;
    if (comment) {
      try {
        meta = JSON.parse(comment);
      } catch {
        throw new Error("Metadata konten rusak; impor dibatalkan.");
      }
    }
    const record =
      typeof meta === "object" && meta !== null ? (meta as Record<string, unknown>) : {};
    const base = { no, title: text(r[1]), prompt: text(r[2]), caption: text(r[3]) };
    const exact = isExactTemplate(base);
    return contentSchema.parse({
      ...record,
      ...base,
      ...(headers.length > 4
        ? {
            legacyCells: headers
              .slice(4)
              .map((h, i) => ({ column: i + 4, header: text(h), value: r[i + 4] ?? "" })),
          }
        : {}),
      id: p ? text(p[0]) : exact ? `system-template-${no}` : crypto.randomUUID(),
      // A workbook comment is never authority to grant workspace ownership or system write access.
      classification:
        exact && (!p || text(p[0]) === `system-template-${no}`)
          ? "SYSTEM_TEMPLATE"
          : "PERSONAL_CONTENT",
      status: p ? text(p[15]).toLowerCase() : "draft",
      production: p
        ? {
            category: p[2],
            audience: text(p[3]),
            platform: text(p[4]),
            format: p[5],
            hook: text(p[6]),
            script: text(p[7]),
            scenes: text(p[8]),
            visualDirection: text(p[9]),
            voiceOver: text(p[10]),
            cta: text(p[11]),
            hashtags: text(p[12]),
            thumbnailText: text(p[13]),
            duration: Number(p[14]),
          }
        : {},
    });
  });
  validateNumbers(result);
  if (
    productionRows.length &&
    (productionRows.length !== result.length ||
      productionRows.some((p) => !result.some((r) => r.no === Number(p[1]))))
  )
    throw new Error("Relasi kedua sheet tidak lengkap; tidak ada data yang dibuang.");
  return result;
}
