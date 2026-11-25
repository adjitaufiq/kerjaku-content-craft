import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { campaignSchema } from "./factory-types";
import { nextFactoryStage, qualityCheck, mayReplayFactoryTask } from "./factory-policy";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const databases: PGlite[] = [];
async function fixture() {
  const db = new PGlite();
  databases.push(db);
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  await db.exec(
    await readFile(
      new URL("../../docs/factory/001_connected_workflow.sql", import.meta.url),
      "utf8",
    ),
  );
  return db;
}
async function user(db: PGlite, id: string) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id}',false); SET ROLE authenticated;`,
  );
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.close();
});
describe("Connected factory — local SQL, not production verification", () => {
  it("creates exactly 10 jobs for the requested campaign and isolates account B", async () => {
    const db = await fixture();
    await user(db, A);
    await db.query("SELECT craft_create_campaign($1,$2,10)", [
      "10 Konten Edukasi AI Automation untuk KERJAKU",
      {},
    ]);
    expect((await db.query("SELECT * FROM craft_tasks")).rows).toHaveLength(10);
    await user(db, B);
    expect((await db.query("SELECT * FROM craft_tasks")).rows).toHaveLength(0);
    expect((await db.query("SELECT * FROM craft_campaigns")).rows).toHaveLength(0);
  });
  it("prevents claiming by users and prevents a second worker from claiming the same task", async () => {
    const db = await fixture();
    await user(db, A);
    await db.query("SELECT craft_create_campaign($1,$2,1)", ["One educational campaign", {}]);
    await expect(db.query("SELECT * FROM craft_claim_task('worker-a')")).rejects.toThrow(
      "permission denied",
    );
    await db.exec("RESET ROLE; SET ROLE service_role");
    const first = await db.query("SELECT * FROM craft_claim_task('worker-a')");
    expect(first.rows).toHaveLength(1);
    expect((await db.query("SELECT * FROM craft_claim_task('worker-b')")).rows).toHaveLength(0);
  });
  it("checks lease ownership and disallows skipping from research to publication", async () => {
    const db = await fixture();
    await user(db, A);
    await db.query("SELECT craft_create_campaign($1,$2,1)", ["One educational campaign", {}]);
    await db.exec("RESET ROLE; SET ROLE service_role");
    const task = (await db.query<{ id: string }>("SELECT * FROM craft_claim_task('worker-a')"))
      .rows[0];
    if (!task) throw new Error("No task");
    expect(
      (
        await db.query<{ ok: boolean }>(
          "SELECT craft_complete_task($1,'worker-b','{}','script') AS ok",
          [task.id],
        )
      ).rows[0]?.ok,
    ).toBe(false);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "SELECT craft_complete_task($1,'worker-a','{}','distribution') AS ok",
          [task.id],
        )
      ).rows[0]?.ok,
    ).toBe(false);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "SELECT craft_complete_task($1,'worker-a','{}','script') AS ok",
          [task.id],
        )
      ).rows[0]?.ok,
    ).toBe(true);
  });
  it("quarantines a stale job instead of replaying potentially completed generation", async () => {
    const db = await fixture();
    await user(db, A);
    await db.query("SELECT craft_create_campaign($1,$2,1)", ["One educational campaign", {}]);
    await db.exec("RESET ROLE; SET ROLE service_role");
    await db.query("SELECT * FROM craft_claim_task('worker-a')");
    await db.exec("UPDATE craft_tasks SET lease_until=now()-interval '1 second'");
    expect((await db.query("SELECT * FROM craft_claim_task('worker-b')")).rows).toHaveLength(0);
    expect(
      (await db.query<{ state: string }>("SELECT state FROM craft_tasks")).rows[0]?.state,
    ).toBe("reconciliation_required");
  });
  it("rejects system templates and client publishing status in bank writes", async () => {
    const db = await fixture();
    await user(db, A);
    await expect(
      db.query("SELECT craft_save_bank($1)", [
        [{ id: A, no: 1, classification: "SYSTEM_TEMPLATE", status: "draft" }],
      ]),
    ).rejects.toThrow("System templates");
    await expect(
      db.query("SELECT craft_save_bank($1)", [
        [{ id: A, no: 31, classification: "PERSONAL_CONTENT", status: "published" }],
      ]),
    ).rejects.toThrow("Publishing states");
  });
  it("requires actual image, voice, subtitle and video evidence at quality gate", () => {
    expect(qualityCheck([], "Narasi").passed).toBe(false);
    expect(
      qualityCheck(
        ["image", "voice", "subtitle", "video"].map((kind) => ({
          kind: kind as "image" | "voice" | "subtitle" | "video",
          path: "asset",
          bucket: "private",
          mime: "test",
          bytes: 100,
          checksum: "a".repeat(64),
          duration: 20,
        })),
        "Narasi",
      ).passed,
    ).toBe(true);
  });
  it("keeps retry safe when provider outcome is unknown", () => {
    expect(mayReplayFactoryTask("running", "unknown")).toBe(false);
    expect(mayReplayFactoryTask("blocked", "unknown")).toBe(false);
    expect(nextFactoryStage("render")).toBe("quality");
  });
  it("accepts the 10-content request and 5/7/10 carousel lengths", () => {
    for (const slides of [5, 7, 10])
      expect(
        campaignSchema.parse({
          command: "10 Konten Edukasi AI Automation untuk KERJAKU",
          count: 10,
          audience: "Pemilik bisnis Indonesia",
          platforms: ["tiktok", "instagram"],
          slides,
        }).count,
      ).toBe(10);
  });
  it("stores a generated script once under the leased task and assigns a fresh bank number", async () => {
    const db = await fixture();
    await user(db, A);
    await db.query("SELECT craft_create_campaign($1,$2,1)", ["One educational campaign", {}]);
    await db.exec("RESET ROLE; SET ROLE service_role");
    const task = (await db.query<{ id: string }>("SELECT * FROM craft_claim_task('worker-a')"))
      .rows[0];
    if (!task) throw new Error("No task");
    await db.query("SELECT craft_complete_task($1,'worker-a','{}','script')", [task.id]);
    await db.query("SELECT * FROM craft_claim_task('worker-a')");
    const doc = {
      id: B,
      no: 100001,
      classification: "PERSONAL_CONTENT",
      status: "draft",
      revision: 1,
    };
    const first = await db.query<{ doc: { no: number } }>(
      "SELECT craft_store_generated($1,'worker-a',$2) AS doc",
      [task.id, doc],
    );
    expect(first.rows[0]?.doc.no).toBe(31);
    await db.query("SELECT craft_store_generated($1,'worker-a',$2)", [task.id, doc]);
    expect((await db.query("SELECT * FROM craft_bank")).rows).toHaveLength(1);
    await user(db, A);
    expect((await db.query("SELECT * FROM craft_bank")).rows).toHaveLength(1);
    await user(db, B);
    expect((await db.query("SELECT * FROM craft_bank")).rows).toHaveLength(0);
  });
});
