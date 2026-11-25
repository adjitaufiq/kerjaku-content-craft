/** Test-only PostgREST/storage transport. Never imported by app routes or workers. */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PGlite } from "@electric-sql/pglite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

const tables = new Set([
  "craft_campaigns",
  "craft_tasks",
  "craft_bank",
  "craft_media",
  "craft_distribution",
  "craft_metric_snapshots",
  "craft_runtime_health",
  "ai_usage_events",
]);
const functions: Record<string, { args: string[]; table: boolean }> = {
  craft_claim_task: { args: ["worker"], table: true },
  craft_complete_task: { args: ["task_id", "worker", "result", "next_stage"], table: false },
  craft_store_generated: { args: ["task_id", "worker", "document"], table: false },
  craft_enqueue_distribution: { args: ["task_id", "worker", "packages"], table: false },
};
const identifier = (value: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error("Unsafe fixture SQL identifier");
  return `"${value}"`;
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export function localStorageFile(root: string, path: string) {
  const target = resolve(root, path);
  if (!target.startsWith(resolve(root) + sep)) throw new Error("Unsafe fixture file path");
  return target;
}

export function localFactoryClient(db: PGlite, storage: string) {
  return createClient<Database>("https://storage.fixture.invalid", "test-only-publishable", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        );
        const method = init?.method ?? "GET";
        try {
          const path = decodeURIComponent(url.pathname);
          if (path.startsWith("/storage/v1/")) {
            const uploadSign = "/storage/v1/object/upload/sign/";
            const readSign = "/storage/v1/object/sign/";
            if (path.startsWith(uploadSign))
              return json({
                url: path.slice("/storage/v1".length) + "?token=local-fixture",
                token: "local-fixture",
              });
            if (path.startsWith(readSign))
              return json({ signedURL: path.slice("/storage/v1".length) + "?token=local-fixture" });
            const key = path.slice("/storage/v1/object/".length);
            const file = localStorageFile(storage, key);
            if (method === "GET")
              return new Response(new Uint8Array(await readFile(file)), {
                headers: { "Content-Type": "application/octet-stream" },
              });
            await mkdir(dirname(file), { recursive: true });
            const bytes = new Uint8Array(await new Response(init?.body).arrayBuffer());
            await writeFile(file, bytes);
            return json({ Key: key });
          }
          const body: Record<string, unknown> =
            typeof init?.body === "string" ? JSON.parse(init.body) : {};
          if (path.startsWith("/rest/v1/rpc/")) {
            const name = path.split("/").at(-1) ?? "";
            const fn = functions[name];
            if (!fn) throw new Error("Unsupported fixture RPC");
            const values = fn.args.map((arg) =>
              typeof body[arg] === "object" ? JSON.stringify(body[arg]) : body[arg],
            );
            const result = await db.query<Record<string, unknown>>(
              `SELECT ${fn.table ? "* FROM" : ""} ${identifier(name)}(${values.map((_, i) => `$${i + 1}`).join(",")})${fn.table ? "" : " AS value"}`,
              values,
            );
            return json(fn.table ? result.rows : (result.rows[0]?.["value"] ?? null));
          }
          const name = path.split("/").at(-1) ?? "";
          if (!tables.has(name)) throw new Error("Unsupported fixture table");
          const values: unknown[] = [];
          const parameter = (value: unknown) => {
            values.push(
              typeof value === "object" && value !== null ? JSON.stringify(value) : value,
            );
            return `$${values.length}`;
          };
          const where: string[] = [];
          for (const [column, expression] of url.searchParams) {
            if (["select", "order", "limit", "on_conflict"].includes(column)) continue;
            const dot = expression.indexOf(".");
            const op = expression.slice(0, dot);
            if (op !== "eq" && op !== "gt") throw new Error("Unsupported fixture filter");
            where.push(
              `${identifier(column)} ${op === "eq" ? "=" : ">"} ${parameter(expression.slice(dot + 1))}`,
            );
          }
          const predicate = where.length ? ` WHERE ${where.join(" AND ")}` : "";
          let sql: string;
          if (method === "GET") {
            const selection = url.searchParams.get("select") ?? "*";
            sql = `SELECT ${selection === "*" ? "*" : selection.split(",").map(identifier).join(",")} FROM ${identifier(name)}${predicate}`;
            const order = url.searchParams.get("order");
            if (order)
              sql +=
                " ORDER BY " +
                order
                  .split(",")
                  .map((part) => {
                    const [column, direction] = part.split(".");
                    return `${identifier(column ?? "")} ${direction === "desc" ? "DESC" : "ASC"}`;
                  })
                  .join(",");
            const limit = url.searchParams.get("limit");
            if (limit) sql += ` LIMIT ${parameter(Number(limit))}`;
          } else if (method === "PATCH") {
            sql = `UPDATE ${identifier(name)} SET ${Object.entries(body)
              .map(([key, value]) => `${identifier(key)}=${parameter(value)}`)
              .join(",")}${predicate} RETURNING *`;
          } else if (method === "POST") {
            const keys = Object.keys(body);
            sql = `INSERT INTO ${identifier(name)}(${keys.map(identifier).join(",")}) VALUES(${keys.map((key) => parameter(body[key])).join(",")})`;
            const conflict = url.searchParams.get("on_conflict");
            if (conflict)
              sql += ` ON CONFLICT(${conflict.split(",").map(identifier).join(",")}) DO UPDATE SET ${keys.map((key) => `${identifier(key)}=EXCLUDED.${identifier(key)}`).join(",")}`;
            sql += " RETURNING *";
          } else throw new Error("Unsupported fixture method");
          const result = await db.query(sql, values);
          const headers = new Headers(init?.headers);
          return json(
            headers.get("Accept")?.includes("vnd.pgrst.object")
              ? (result.rows[0] ?? null)
              : result.rows,
          );
        } catch (error) {
          return json(
            {
              message: error instanceof Error ? error.message : "Local fixture error",
              code: "LOCAL_FIXTURE_ERROR",
            },
            400,
          );
        }
      },
    },
  });
}
