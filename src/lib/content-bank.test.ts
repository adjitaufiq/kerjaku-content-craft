import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  BANK_HEADERS,
  SCRIPT_HEADERS,
  CONTENT_CATEGORIES,
  systemTemplates,
  forkContent,
  reviseContent,
  validateStatusTransition,
  validateTrendEvidence,
} from "./content-bank";
import { exportContentWorkbook, importContentWorkbook } from "./content-bank-excel";

describe("Content Bank rules", () => {
  it("preserves all four legacy fields in the two-sheet roundtrip", () => {
    const original = systemTemplates();
    const bytes = exportContentWorkbook(original);
    const wb = XLSX.read(bytes, { type: "array" });
    expect(wb.SheetNames).toEqual(["BANK KONTEN", "PRODUCTION SCRIPT"]);
    const bank = wb.Sheets["BANK KONTEN"];
    const script = wb.Sheets["PRODUCTION SCRIPT"];
    if (!bank || !script) throw new Error("Missing workbook sheets");
    expect(XLSX.utils.sheet_to_json(bank, { header: 1 })[0]).toEqual(BANK_HEADERS);
    expect(XLSX.utils.sheet_to_json(script, { header: 1 })[0]).toEqual(SCRIPT_HEADERS);
    expect(importContentWorkbook(bytes)).toEqual(original);
  });
  it("preserves script, multiline text, tags and version history without extra columns", () => {
    const first = systemTemplates()[0];
    if (!first) throw new Error("Missing template");
    const personal = forkContent(first, 31, "test-content");
    const changed = reviseContent(
      personal,
      {
        title: "  Nama | asli  ",
        tags: ["AI", "Bisnis"],
        subcategory: "Workflow",
        production: {
          ...personal.production,
          script: "Adegan 1\nAdegan 2",
          voiceOver: "  Narasi asli\nlanjutan  ",
          duration: 42,
        },
      },
      "2026-11-25T00:00:00Z",
    );
    expect(importContentWorkbook(exportContentWorkbook([changed]))).toEqual([changed]);
  });
  it("imports a legacy one-sheet workbook without losing prompt or caption", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        Array.from(BANK_HEADERS),
        [31, "Ide", "Prompt\nvisual", "Caption asli"],
      ]),
      "Sheet1",
    );
    const result = importContentWorkbook(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    expect(result[0]?.prompt).toBe("Prompt\nvisual");
    expect(result[0]?.caption).toBe("Caption asli");
  });
  it("preserves STATUS and CATATAN from the actual legacy layout as metadata", () => {
    const first = systemTemplates()[0];
    if (!first) throw new Error("Missing template");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [...BANK_HEADERS, "", "STATUS", "CATATAN"],
        [first.no, first.title, first.prompt, first.caption, "", "DRAFT", "Catatan asli"],
      ]),
      "Bank Konten 1-30",
    );
    const imported = importContentWorkbook(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    expect(imported[0]?.legacyCells[2]?.value).toBe("Catatan asli");
    expect(importContentWorkbook(exportContentWorkbook(imported))).toEqual(imported);
  });
  it("does not overwrite any of the 30 system templates", () => {
    const templates = systemTemplates();
    expect(templates).toHaveLength(30);
    for (const template of templates)
      expect(() => reviseContent(template, { prompt: "changed" })).toThrow();
  });
  it("forks a template into personal content with a new ID", () => {
    const first = systemTemplates()[0];
    if (!first) throw new Error("Missing template");
    const copy = forkContent(first, 31, "new-id");
    expect(copy.id).toBe("new-id");
    expect(copy.classification).toBe("PERSONAL_CONTENT");
    expect(first.classification).toBe("SYSTEM_TEMPLATE");
  });
  it("rejects duplicate content numbers instead of dropping data", () => {
    const first = systemTemplates()[0];
    if (!first) throw new Error("Missing template");
    expect(() => exportContentWorkbook([first, forkContent(first, 1, "different-id")])).toThrow(
      "Nomor konten ganda",
    );
  });
  it("keeps published content unchanged and cannot fabricate published/scheduled status", () => {
    const first = systemTemplates()[0];
    if (!first) throw new Error("Missing template");
    const content = forkContent(first, 31);
    expect(() => validateStatusTransition(content, "published")).toThrow();
    expect(() => validateStatusTransition(content, "scheduled")).toThrow();
    expect(() =>
      reviseContent({ ...content, status: "published" }, { title: "changed" }),
    ).toThrow();
  });
  it("distinguishes actual Trending evidence from predicted Viral Opportunity", () => {
    expect(CONTENT_CATEGORIES).toEqual([
      "Educational",
      "Informational",
      "Trending",
      "Viral Opportunity",
      "Storytelling",
      "Problem-Solution",
      "Promotional",
      "Engagement",
      "Conversion",
    ]);
    expect(validateTrendEvidence("Trending", [])).toBe(false);
    expect(validateTrendEvidence("Viral Opportunity", [])).toBe(true);
  });
});
