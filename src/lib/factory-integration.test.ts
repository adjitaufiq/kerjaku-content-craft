import { afterEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  campaignSchema,
  type TaskOutput,
  type WorkerInput,
  type FactoryTask,
} from "./factory-types";
import { localFactoryClient, localStorageFile } from "./testing/factory-local-adapter";
import { campaignScriptDocument, type GeneratedScript } from "./factory-script-request";
import { prepareProductionContent, nativeFiles } from "./factory-plan";
import { contentSchema, forkContent, systemTemplates } from "./content-bank";
import { exportContentWorkbook, importContentWorkbook } from "./content-bank-excel";
import { executeFactoryWorker } from "./factory-worker.server";

const fixtures = vi.hoisted(() => ({ image: "", script: null as GeneratedScript | null }));
vi.mock("@lovable.dev/ai-gateway", async (original) => ({
  ...(await original<typeof import("@lovable.dev/ai-gateway")>()),
  generateImage: vi.fn(async () => ({ data: [{ b64_json: fixtures.image }] })),
}));
vi.mock("./ai-router.server", () => ({
  routeTaskStructured: vi.fn(async () => ({ result: fixtures.script })),
}));
const run = promisify(execFile);
const A = "11111111-1111-4111-8111-111111111111";
const databases: PGlite[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const db of databases.splice(0)) await db.close();
});

const scenes = [
  {
    heading: "Mulai dari satu proses",
    narration: "Ingin memakai AI untuk bisnis? Mulai dari pekerjaan berulang.",
    visual: "Pemilik bisnis memetakan pekerjaan di meja kerja.",
  },
  {
    heading: "Petakan pekerjaan",
    narration: "Tuliskan pekerjaan yang berulang, seperti merangkum pertanyaan pelanggan.",
    visual: "Daftar tugas dan pesan pelanggan di komputer.",
  },
  {
    heading: "Pilih satu alur",
    narration: "Pilih satu alur sederhana yang datanya sudah tersedia.",
    visual: "Tiga kotak proses tersambung di papan kerja.",
  },
  {
    heading: "Tetap verifikasi",
    narration: "Gunakan AI untuk membuat draf, bukan mengambil keputusan penting sendiri.",
    visual: "Manusia meninjau draf jawaban di layar.",
  },
  {
    heading: "Jaga data",
    narration: "Periksa hasilnya dan lindungi informasi pribadi pelanggan.",
    visual: "Data pelanggan terlindungi dalam antarmuka aplikasi.",
  },
  {
    heading: "Ukur dan perbaiki",
    narration: "Catat hasil uji sebelum memperluas otomatisasi ke proses berikutnya.",
    visual: "Pemilik bisnis mencatat hasil pengujian proses.",
  },
  {
    heading: "Diskusikan bersama KERJAKU",
    narration: "Diskusikan kebutuhan otomatisasi bisnismu bersama KERJAKU.",
    visual: "Tim digital studio membahas alur kerja.",
  },
];
const script: GeneratedScript = {
  title: "AI Automation: Mulai dari Satu Proses",
  prompt: "Ilustrasi editorial proses bisnis dan AI, objek jelas, vertikal.",
  caption:
    "Mulai otomatisasi dari satu pekerjaan berulang. Petakan, uji, periksa, lalu perbaiki bersama KERJAKU.",
  category: "Educational",
  hook: "Ingin memakai AI untuk bisnis?",
  script: scenes.map((s) => s.narration).join("\n"),
  visualDirection: "Alur kerja bisnis sederhana, pemeriksaan manusia.",
  voiceOver: "Ignored: scenes are the narration authority.",
  cta: "Diskusikan kebutuhan otomatisasi bersama KERJAKU.",
  hashtags: "#KERJAKU #AIAutomation #BisnisIndonesia",
  thumbnailText: "Mulai dari satu proses",
  angle: "uji satu proses",
  reason: "Edukasi praktis tanpa klaim metrik",
  scenes,
};

describe("Production narration handoff", () => {
  it("uses scene narration as the single input to MP3, subtitles and storyboard", () => {
    const config = campaignSchema.parse({
      command: "10 Konten Edukasi AI Automation untuk KERJAKU",
      count: 10,
      audience: "Pemilik bisnis Indonesia",
      platforms: ["instagram"],
    });
    const content = campaignScriptDocument(config, script, 1, A);
    expect(content.production.voiceOver).toBe(scenes.map((s) => s.narration).join(" "));
    const template = systemTemplates()[0];
    if (!template) throw new Error("Template missing");
    const seed = forkContent(template, 31, A);
    seed.production = content.production;
    seed.production.voiceOver = "Legacy narration differs";
    expect(prepareProductionContent(seed).production.voiceOver).toBe(
      scenes.map((s) => s.narration).join(" "),
    );
    expect(seed.production.voiceOver).toBe("Legacy narration differs");
  });
  it("allocates exactly ten independent carousel images", () => {
    const config = campaignSchema.parse({
      command: "10 Konten Edukasi AI Automation untuk KERJAKU",
      count: 10,
      audience: "Pemilik bisnis Indonesia",
      platforms: ["instagram"],
      formats: ["Carousel"],
      slides: 10,
    });
    expect(nativeFiles("design", config, 1).map((f) => f.filename)).toEqual(
      Array.from({ length: 10 }, (_, i) => `carousel-${String(i + 1).padStart(2, "0")}.png`),
    );
  });
});

describe("One campaign → actual queue executor → native worker → library → distribution (LOCAL FIXTURES)", () => {
  it.skipIf(process.env["CRAFT_CONNECTED_MEDIA"] !== "1").each([
    {
      name: "poster + seven-slide carousel + video",
      formats: ["Foto", "Carousel", "Video"] as const,
      slides: 7,
    },
    { name: "poster-only", formats: ["Foto"] as const, slides: 5 },
    { name: "ten-slide carousel-only", formats: ["Carousel"] as const, slides: 10 },
  ])(
    "$name flows from command to library and held distribution without re-entering inputs",
    async (scenario) => {
      const folder = await mkdtemp(join(tmpdir(), "craft-connected-"));
      const source = process.env["CRAFT_TEST_IMAGE"];
      if (!source)
        throw new Error("CRAFT_TEST_IMAGE must point to the existing AI artwork fixture");
      fixtures.image = (await readFile(source)).toString("base64");
      fixtures.script = script;
      // Research HTTP and AI results are explicitly recorded fixtures, not claims of current/live inference.
      vi.spyOn(globalThis, "fetch").mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              hits: [
                {
                  title: "AI automation workflow discussion (fixture)",
                  url: "https://news.ycombinator.com/item?id=fixture",
                  objectID: "fixture",
                  created_at: "2026-11-01T00:00:00Z",
                  points: 3,
                  num_comments: 2,
                },
              ],
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
      );
      const config = campaignSchema.parse({
        command: "10 Konten Edukasi AI Automation untuk KERJAKU",
        count: 10,
        audience: "Pemilik bisnis Indonesia",
        platforms: ["instagram", "tiktok", "facebook", "youtube"],
        mode: "economy",
        slides: scenario.slides,
        formats: [...scenario.formats],
      });
      const db = new PGlite();
      databases.push(db);
      await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE TABLE content_bank(user_id uuid,content_number integer); CREATE TABLE content_logs(user_id uuid,content_number integer);
      CREATE TABLE craft_runtime_health(id text PRIMARY KEY,ai_pause_reason text,ai_paused_until timestamptz,server_scheduler_enabled boolean DEFAULT false,scheduler_verified_at timestamptz);
      INSERT INTO craft_runtime_health(id) VALUES('default');
      CREATE TABLE ai_usage_events(id uuid PRIMARY KEY,user_id uuid,capability text,model text,provider text,state text,input_tokens integer,output_tokens integer,error_code text);
      GRANT ALL ON craft_runtime_health,ai_usage_events TO service_role;`);
      for (const file of ["001_connected_workflow.sql", "002_distribution_learning.sql"])
        await db.exec(
          await readFile(new URL(`../../docs/factory/${file}`, import.meta.url), "utf8"),
        );
      await db.exec(
        `SELECT set_config('request.jwt.claim.sub','${A}',false); SET ROLE authenticated;`,
      );
      const created = await db.query<{ id: string }>(
        "SELECT craft_create_campaign($1,$2,10) AS id",
        [config.command, JSON.stringify(config)],
      );
      const campaignId = created.rows[0]?.id;
      if (!campaignId) throw new Error("Campaign not created");
      await db.exec("RESET ROLE; SET ROLE service_role;");
      const storage = join(folder, "storage");
      const client = localFactoryClient(db, storage);
      const stages: string[] = [];
      let taskId = "";
      for (let step = 0; step < 9; step++) {
        const before = await db.query<FactoryTask>(
          "SELECT * FROM craft_tasks WHERE campaign_id=$1 AND ordinal=1",
          [campaignId],
        );
        const current = before.rows[0];
        if (!current) throw new Error("Task missing");
        taskId = current.id;
        if (current.state === "succeeded") break;
        stages.push(current.stage);
        const result = await executeFactoryWorker(
          client,
          { action: "claim", worker: "local-integration-worker" },
          "https://storage.fixture.invalid",
        );
        if ("task" in result && result.task) {
          const packet = join(folder, `task-${current.stage}.json`);
          const receipt = join(folder, `receipt-${current.stage}.json`);
          await writeFile(packet, JSON.stringify(result.task));
          await run("python3", ["worker/local_queue.py", packet, storage, receipt], {
            cwd: process.cwd(),
            timeout: 240000,
            maxBuffer: 1024 * 1024,
          });
          const assets: WorkerInput["assets"] = JSON.parse(await readFile(receipt, "utf8"));
          if (!assets) throw new Error("Native receipt missing");
          if (current.stage === "design") {
            expect(
              await executeFactoryWorker(
                client,
                {
                  action: "complete",
                  worker: "local-integration-worker",
                  taskId,
                  assets: assets.map((asset) => ({ ...asset, checksum: "0".repeat(64) })),
                },
                "https://storage.fixture.invalid",
              ).then(
                () => "accepted",
                (error: Error) => error.message,
              ),
            ).toBe("Output checksum mismatch");
          }
          expect(
            await executeFactoryWorker(
              client,
              { action: "complete", worker: "local-integration-worker", taskId, assets },
              "https://storage.fixture.invalid",
            ),
          ).toEqual({ completed: true });
        } else expect(result).toMatchObject({ completed: true });
      }
      const video = scenario.formats.some((format) => format === "Video");
      expect(stages).toEqual([
        "research",
        "script",
        "image",
        "design",
        ...(video ? ["voice", "render"] : []),
        "quality",
        "distribution",
      ]);
      const finished = (
        await db.query<{ state: string; output: TaskOutput }>(
          "SELECT state,output FROM craft_tasks WHERE id=$1",
          [taskId],
        )
      ).rows[0];
      expect(finished?.state).toBe("succeeded");
      const output = finished?.output;
      if (!output?.content || !output.assets) throw new Error("Connected content missing");
      expect(output.qc?.passed).toBe(true);
      const content = contentSchema.parse(output.content);
      const workbook = exportContentWorkbook([content]);
      expect(importContentWorkbook(workbook)[0]?.production.voiceOver).toBe(
        content.production.voiceOver,
      );
      await writeFile(join(folder, "content-bank.xlsx"), workbook);
      const library = (
        await db.query<{ path: string; bytes: number; checksum: string }>(
          "SELECT path,bytes,checksum FROM craft_media WHERE campaign_id=$1",
          [campaignId],
        )
      ).rows;
      const stillCount = scenario.formats.some((format) => format === "Foto") ? 2 : 0;
      const carouselCount = scenario.formats.some((format) => format === "Carousel")
        ? scenario.slides
        : 0;
      expect(library).toHaveLength(3 + stillCount + carouselCount + (video ? 6 : 0) + 1);
      for (const asset of library) {
        const bytes = await readFile(localStorageFile(storage, `instagram-media/${asset.path}`));
        expect(bytes.length).toBe(Number(asset.bytes));
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.checksum);
      }
      const queue = (
        await db.query<{
          state: string;
          format: string;
          package: { caption: string; contentId: string };
        }>("SELECT * FROM craft_distribution WHERE campaign_id=$1", [campaignId])
      ).rows;
      expect(queue).toHaveLength(scenario.formats.length * 4);
      expect(queue.filter((d) => d.state === "awaiting_authorization")).toHaveLength(
        scenario.formats.length * 3 + (video ? 1 : 0),
      );
      expect(
        queue.every(
          (d) => d.package.caption === content.caption && d.package.contentId === content.id,
        ),
      ).toBe(true);
      expect(
        (await db.query("SELECT * FROM craft_claim_distribution('local-publisher')")).rows,
      ).toHaveLength(0);
      expect((await db.query("SELECT * FROM craft_metric_snapshots")).rows).toHaveLength(0);
      expect((await db.query("SELECT * FROM craft_tasks WHERE state='queued'")).rows).toHaveLength(
        9,
      );
      await writeFile(
        join(folder, "verification.json"),
        JSON.stringify(
          {
            command: config.command,
            scenario: scenario.name,
            evidence:
              "local integration: fixture research/AI/HTTPS storage; actual PostgreSQL SQL, app executor and native FFmpeg/eSpeak consumer",
            campaignId,
            contentId: content.id,
            stages,
            assets: library,
            queue,
            publicPosts: 0,
          },
          null,
          2,
        ),
      );
      console.log("CONNECTED_LOCAL_ARTIFACTS", folder);
    },
    300000,
  );
});
