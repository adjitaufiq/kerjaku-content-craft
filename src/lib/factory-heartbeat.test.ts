import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { workerInput } from "./factory-types";

const databases: PGlite[] = [];
const owner = "11111111-1111-4111-8111-111111111111";
async function fixture() {
  const db = new PGlite();
  databases.push(db);
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${owner}'::uuid $$;
    CREATE TABLE content_bank(user_id uuid,content_number integer);
    CREATE TABLE content_logs(user_id uuid,content_number integer);`);
  await db.exec(await readFile(new URL("../../docs/factory/001_connected_workflow.sql", import.meta.url), "utf8"));
  const sql = await readFile(new URL("../../docs/factory/003_worker_heartbeat.sql", import.meta.url), "utf8");
  await db.exec(sql);
  await db.exec(sql); // Function migration must be safely repeatable.
  await db.query("SELECT craft_create_campaign('Heartbeat campaign', '{}', 1)");
  await db.exec("SET ROLE service_role");
  const task = (await db.query<{ id: string }>("SELECT * FROM craft_claim_task('worker-a')")).rows[0];
  if (!task) throw new Error("Task missing");
  return { db, id: task.id };
}
async function renew(db: PGlite, id: string, worker = "worker-a") {
  return (await db.query<{ lease: string | null }>("SELECT craft_renew_lease($1,$2) AS lease", [id, worker])).rows[0]?.lease;
}
afterEach(async () => { for (const db of databases.splice(0)) await db.close(); });
describe("Atomic heartbeat — isolated SQL, no production migration", () => {
  it("requires task identity for heartbeat and renew_lease", () => {
    for (const action of ["heartbeat", "renew_lease"]) {
      expect(workerInput.safeParse({ action, worker: "worker-a" }).success).toBe(false);
      expect(workerInput.safeParse({ action, worker: "worker-a", taskId: owner }).success).toBe(true);
    }
  });
  it("only renews the owning worker and excludes duplicate claims", async () => {
    const { db, id } = await fixture();
    expect(await renew(db, id, "worker-b")).toBeNull();
    await db.exec("UPDATE craft_tasks SET lease_until=clock_timestamp()+interval '1 second'");
    expect(await renew(db, id)).toBeTruthy();
    expect((await db.query<{ seconds: number }>("SELECT extract(epoch FROM lease_until-clock_timestamp()) AS seconds FROM craft_tasks")).rows[0]?.seconds).toBeGreaterThan(1790);
    expect((await db.query("SELECT * FROM craft_claim_task('worker-b')")).rows).toHaveLength(0);
  });
  it.each(["cancelled", "succeeded", "blocked"])("does not renew a %s task", async (state) => {
    const { db, id } = await fixture();
    await db.query("UPDATE craft_tasks SET state=$1", [state]);
    expect(await renew(db, id)).toBeNull();
  });
  it("does not renew cancelled campaigns or expired leases", async () => {
    const { db, id } = await fixture();
    await db.exec("UPDATE craft_campaigns SET state='cancelled'");
    expect(await renew(db, id)).toBeNull();
    await db.exec("UPDATE craft_campaigns SET state='running'; UPDATE craft_tasks SET lease_until=clock_timestamp()-interval '1 second'");
    expect(await renew(db, id)).toBeNull();
  });
  it("does not expose renewal to dashboard clients", async () => {
    const { db, id } = await fixture();
    await db.exec("RESET ROLE; SET ROLE authenticated");
    await expect(renew(db, id)).rejects.toThrow("permission denied");
  });
});