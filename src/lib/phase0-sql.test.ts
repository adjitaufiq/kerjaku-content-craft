import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const LOG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const clients: PGlite[] = [];
async function migration(name: string) {
  return readFile(new URL(`../../docs/phase0/migrations/${name}`, import.meta.url), "utf8");
}
async function fixture(fillManifest = true) {
  const db = new PGlite();
  clients.push(db);
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    GRANT USAGE ON SCHEMA public, auth, storage TO authenticated, anon, service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TYPE public.app_role AS ENUM ('admin','user');
    CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
    CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
    INSERT INTO public.user_roles VALUES ('${A}','admin'),('${B}','admin');
    CREATE TABLE public.content_bank(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),content_number int UNIQUE,caption text DEFAULT '',title text DEFAULT '',prompt text DEFAULT '');
    CREATE TABLE public.content_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),content_number int,caption text DEFAULT '',image_url text,image_urls text[],status text DEFAULT 'draft',scheduled_at timestamptz,ig_post_id text,ig_creation_id text,error_message text);
    CREATE TABLE public.content_downloads(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE public.brand_products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid);
    CREATE TABLE public.meta_credentials(id text PRIMARY KEY);
    CREATE TABLE public.meta_token_meta(id text PRIMARY KEY);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner_id text);
    GRANT ALL ON storage.objects TO authenticated, anon, service_role;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY old_open ON storage.objects FOR ALL TO anon,authenticated USING(bucket_id='instagram-media') WITH CHECK(bucket_id='instagram-media');
    INSERT INTO public.content_bank(id,content_number) VALUES('${LOG_A}',1),('${LOG_B}',2);
    INSERT INTO public.content_logs(id,content_number,image_urls) VALUES('${LOG_A}',1,ARRAY['asset://instagram-media/${A}/photo.jpg']),('${LOG_B}',2,ARRAY['asset://instagram-media/${B}/photo.jpg']);
    INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('instagram-media','${A}/photo.jpg','${A}'),('instagram-media','${B}/photo.jpg','${B}');
  `);
  await db.exec(await migration("001_ownership_review.sql"));
  if (fillManifest)
    await db.exec(`INSERT INTO public.phase0_ownership_manifest(resource_table,resource_id,user_id,evidence) VALUES
    ('content_bank','${LOG_A}','${A}','local fixture verified owner'),('content_bank','${LOG_B}','${B}','local fixture verified owner'),
    ('content_logs','${LOG_A}','${A}','local fixture verified owner'),('content_logs','${LOG_B}','${B}','local fixture verified owner');`);
  return db;
}
async function asUser(db: PGlite, user: string) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${user}',false); SET ROLE authenticated;`,
  );
}
async function asService(db: PGlite) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false); SET ROLE service_role;`,
  );
}
afterEach(async () => {
  for (const db of clients.splice(0)) await db.close();
});

describe("Phase 0 SQL on local PostgreSQL WASM — NOT the live Cloud database", () => {
  it("rolls back isolation when historical ownership has not been reviewed", async () => {
    const db = await fixture(false);
    await expect(db.exec(await migration("002_security_isolation.sql"))).rejects.toThrow(
      "Unresolved ownership",
    );
    await db.exec("ROLLBACK");
    expect(
      (await db.query<{ count: number }>("SELECT count(*)::int FROM public.content_logs")).rows[0]
        ?.count,
    ).toBe(2);
    expect(
      (
        await db.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name='content_logs' AND column_name='user_id'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("backfills reviewed owners without deleting existing rows", async () => {
    const db = await fixture();
    await db.exec(await migration("002_security_isolation.sql"));
    expect(
      (
        await db.query<{ user_id: string }>(
          "SELECT user_id FROM public.content_logs ORDER BY content_number",
        )
      ).rows.map((r) => r.user_id),
    ).toEqual([A, B]);
    expect((await db.query("SELECT * FROM public.content_bank")).rows).toHaveLength(2);
  });
  it("denies reading, modifying and deleting another user's content", async () => {
    const db = await fixture();
    await db.exec(await migration("002_security_isolation.sql"));
    await asUser(db, A);
    expect((await db.query("SELECT * FROM public.content_logs")).rows).toHaveLength(1);
    expect(
      (
        await db.query(
          `UPDATE public.content_logs SET caption='hijacked' WHERE id='${LOG_B}' RETURNING id`,
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query(`DELETE FROM public.content_logs WHERE id='${LOG_B}' RETURNING id`)).rows,
    ).toHaveLength(0);
    await expect(
      db.exec(`INSERT INTO public.content_logs(user_id,id) VALUES('${B}',gen_random_uuid())`),
    ).rejects.toThrow("row-level security");
    await asService(db);
    expect(
      (
        await db.query<{ caption: string }>(
          `SELECT caption FROM public.content_logs WHERE id='${LOG_B}'`,
        )
      ).rows[0]?.caption,
    ).toBe("");
  });
  it("denies cross-user storage reads, deletes, uploads and anonymous writes", async () => {
    const db = await fixture();
    await db.exec(await migration("002_security_isolation.sql"));
    await asUser(db, A);
    expect((await db.query("SELECT name FROM storage.objects")).rows).toHaveLength(1);
    expect(
      (await db.query(`DELETE FROM storage.objects WHERE name='${B}/photo.jpg' RETURNING name`))
        .rows,
    ).toHaveLength(0);
    await expect(
      db.exec(
        `INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('instagram-media','${B}/hack.jpg','${A}')`,
      ),
    ).rejects.toThrow("row-level security");
    await db.exec("RESET ROLE; SET ROLE anon");
    await expect(
      db.exec(`INSERT INTO storage.objects(bucket_id,name) VALUES('instagram-media','hack.jpg')`),
    ).rejects.toThrow("row-level security");
  });
  it("locks shared credentials and prevents role self-promotion", async () => {
    const db = await fixture();
    await db.exec(await migration("002_security_isolation.sql"));
    await asUser(db, A);
    await expect(db.query("SELECT * FROM public.meta_credentials")).rejects.toThrow(
      "permission denied",
    );
    await expect(db.exec(`INSERT INTO public.user_roles VALUES('${A}','admin')`)).rejects.toThrow(
      "permission denied",
    );
    expect(
      (await db.query<{ has_role: boolean }>(`SELECT public.has_role('${A}','admin')`)).rows[0]
        ?.has_role,
    ).toBe(true);
  });
  it("enqueues one job per content log and denies enqueueing user B's log", async () => {
    const db = await fixture();
    await db.exec(await migration("002_security_isolation.sql"));
    await db.exec(await migration("003_durable_runtime.sql"));
    await asUser(db, A);
    const first = await db.query<{ id: string }>(
      `SELECT public.enqueue_publish_job('${LOG_A}') AS id`,
    );
    const second = await db.query<{ id: string }>(
      `SELECT public.enqueue_publish_job('${LOG_A}') AS id`,
    );
    expect(first.rows[0]?.id).toBeTruthy();
    expect(second.rows[0]?.id).toBe(first.rows[0]?.id);
    await expect(db.query(`SELECT public.enqueue_publish_job('${LOG_B}')`)).rejects.toThrow(
      "Content not found",
    );
  });
  it("lets only one claim win and blocks claiming from authenticated users", async () => {
    const db = await fixture();
    await db.exec(await migration("002_security_isolation.sql"));
    await db.exec(await migration("003_durable_runtime.sql"));
    await asUser(db, A);
    await db.query(`SELECT public.enqueue_publish_job('${LOG_A}')`);
    await expect(
      db.query(`SELECT * FROM public.claim_publish_job('attacker',180,NULL)`),
    ).rejects.toThrow("permission denied");
    await asService(db);
    // PGlite serializes the two SQL sessions; this checks exclusivity, not independent live-worker concurrency.
    const [first, second] = await Promise.all([
      db.query("SELECT * FROM public.claim_publish_job('worker-a',180,NULL)"),
      db.query("SELECT * FROM public.claim_publish_job('worker-b',180,NULL)"),
    ]);
    expect(first.rows.length + second.rows.length).toBe(1);
  });
  it("quarantines a stale in-flight platform submission instead of retrying it", async () => {
    const db = await fixture();
    await db.exec(await migration("002_security_isolation.sql"));
    await db.exec(await migration("003_durable_runtime.sql"));
    await asUser(db, A);
    await db.query(`SELECT public.enqueue_publish_job('${LOG_A}')`);
    await asService(db);
    await db.exec(
      "UPDATE public.publishing_jobs SET state='publishing',lease_owner='dead-worker',lease_until=now()-interval '1 minute',attempt=1,creation_id='accepted-container'",
    );
    await db.query("SELECT public.recover_publish_jobs()");
    expect(
      (await db.query<{ state: string }>("SELECT state FROM public.publishing_jobs")).rows[0]
        ?.state,
    ).toBe("reconciliation_required");
    expect(
      (await db.query("SELECT * FROM public.claim_publish_job('next-worker',180,NULL)")).rows,
    ).toHaveLength(0);
  });
});
