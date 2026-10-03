/* oxlint-disable no-await-in-loop -- Serial requests preserve the benchmark workload and deterministic fixture sequence. */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
const directory = process.env.BENCH_ARTIFACT_DIR ?? "/tmp/summon-migration-control";
const config = JSON.parse(readFileSync(`${directory}/benchmark-private.json`, "utf8"));
const tokens = JSON.parse(readFileSync(`${directory}/convex-session-private.json`, "utf8"));
const client = new ConvexHttpClient("http://127.0.0.1:3210", { logger: false });
client.setAuth(tokens.token);
const workspaceId = await client.mutation(api.workspaces.index.create, {
  name: "Migration benchmark",
  slug: config.slug,
});
const projectId = await client.mutation(api.projects.index.create, {
  workspaceId,
  name: "Benchmark project",
  identifier: "BENCH",
});
let taskId;
for (let index = 0; index < 500; index++)
  taskId = await client.mutation(api.tasks.index.create, {
    projectId,
    title: `Benchmark task ${String(index + 1).padStart(4, "0")}`,
    description: "Benchmark description",
  });
const fixture = { workspaceId, projectId, taskId, rowCount: 500 };
writeFileSync(`${directory}/convex-fixture.json`, JSON.stringify(fixture, null, 2));
console.log(fixture);
