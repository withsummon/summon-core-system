/* oxlint-disable no-await-in-loop -- Serial requests preserve the benchmark workload and deterministic fixture sequence. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient, ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
const directory = process.env.BENCH_ARTIFACT_DIR ?? "/tmp/summon-migration-control";
const read = (name) => JSON.parse(readFileSync(`${directory}/${name}.json`, "utf8"));
const legacy = read("django-fixture");
const candidate = read("convex-fixture");
const session = read("django-session-private");
const tokens = read("convex-session-private");
const client = new ConvexHttpClient("http://127.0.0.1:3210", { logger: false });
client.setAuth(tokens.token);
const origin = process.env.DJANGO_BENCH_ORIGIN ?? "http://localhost:8002";
const base = `${origin}/api/workspaces/${legacy.slug}/projects/${legacy.projectId}/issues/`;
async function django(path = "", options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      Cookie: session.cookie,
      "X-CSRFToken": session.csrf,
      "Content-Type": "application/json",
      Origin: origin,
      ...options.headers,
    },
  });
  const text = await response.text();
  assert.equal(response.status, options.method === "PATCH" ? 204 : 200, text.slice(0, 1000));
  return { data: text ? JSON.parse(text) : null, bytes: Buffer.byteLength(text) };
}
const queryArgs = { projectId: candidate.projectId, paginationOpts: { numItems: 50, cursor: null } };
async function listDjango() {
  const result = await django("?per_page=50");
  assert.equal(result.data.results.length, 50);
  return result.bytes;
}
async function listConvex() {
  const result = await client.query(api.tasks.index.list, queryArgs);
  assert.equal(result.page.length, 50);
  return Buffer.byteLength(JSON.stringify(result));
}
const samples = { djangoRead: [], convexRead: [], djangoWrite: [], convexWrite: [], convexPropagation: [] };
async function time(key, operation, record = true) {
  const start = performance.now();
  const result = await operation();
  if (record) samples[key].push(performance.now() - start);
  return result;
}
for (let i = 0; i < 10; i++) {
  await time("djangoRead", listDjango, false);
  await time("convexRead", listConvex, false);
}
let djangoBytes, convexBytes;
for (let i = 0; i < 50; i++) {
  const actions = [
    async () => (djangoBytes = await time("djangoRead", listDjango)),
    async () => (convexBytes = await time("convexRead", listConvex)),
  ];
  if (i % 2) actions.reverse();
  for (const action of actions) await action();
}
await django(`${legacy.taskId}/`, { method: "PATCH", body: JSON.stringify({ state: legacy.todoId }) });
await client.mutation(api.tasks.index.setStatus, { taskId: candidate.taskId, status: "todo" });
for (let i = 0; i < 50; i++) {
  const done = i % 2 === 0;
  const actions = [
    () =>
      time("djangoWrite", () =>
        django(`${legacy.taskId}/`, {
          method: "PATCH",
          body: JSON.stringify({ state: done ? legacy.doneId : legacy.todoId }),
        })
      ),
    () =>
      time("convexWrite", () =>
        client.mutation(api.tasks.index.setStatus, { taskId: candidate.taskId, status: done ? "done" : "todo" })
      ),
  ];
  if (i % 2) actions.reverse();
  for (const action of actions) await action();
}
const legacyReadback = await django(`${legacy.taskId}/`);
assert.equal(legacyReadback.data.state_id, legacy.todoId);
const candidateReadback = await client.query(api.tasks.index.list, queryArgs);
assert.equal(candidateReadback.page.find((row) => row._id === candidate.taskId).status, "todo");
// A second independent subscribed client must observe the committed row change.
const observer = new ConvexClient("http://127.0.0.1:3210", { logger: false });
observer.setAuth(async () => tokens.token);
let resolveObservation;
let desired;
let initialResolve;
const initial = new Promise((resolve) => {
  initialResolve = resolve;
});
const stop = observer.onUpdate(
  api.tasks.index.list,
  queryArgs,
  (result) => {
    const task = result.page.find((row) => row._id === candidate.taskId);
    assert.ok(task);
    initialResolve();
    if (task.status === desired && resolveObservation) {
      resolveObservation();
      resolveObservation = undefined;
    }
  },
  (error) => {
    throw error;
  }
);
await initial;
for (let i = 0; i < 30; i++) {
  desired = i % 2 === 0 ? "done" : "todo";
  const observed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Second client propagation exceeded 5s")), 5000);
    resolveObservation = () => {
      clearTimeout(timer);
      resolve();
    };
  });
  const start = performance.now();
  await client.mutation(api.tasks.index.setStatus, { taskId: candidate.taskId, status: desired });
  await observed;
  samples.convexPropagation.push(performance.now() - start);
}
stop();
await observer.close();
const summaries = Object.fromEntries(
  Object.entries(samples).map(([name, values]) => {
    const sorted = values.toSorted((a, b) => a - b);
    return [
      name,
      {
        count: values.length,
        p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
        p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
        min: sorted[0],
        max: sorted.at(-1),
      },
    ];
  })
);
const result = {
  candidateArtifact: "c6484ec885",
  controlRuntime: "Gunicorn 23.0.0, two Uvicorn workers, plane.settings.production, DEBUG=0, PostgreSQL15.7",
  candidateRuntime: "Pinned self-hosted Convex native backend, SQLite, local Docker",
  timestamp: new Date().toISOString(),
  controlArtifact: "05f894b84bbde4e2474b82f17be7f4578bc15f14",
  scope:
    "Local Docker, authenticated HTTP, 500 tasks, 50-row first page, sequential alternating backends; not production capacity or full feature parity",
  limitations: [
    "Django returns richer task records and runs its inherited mutation side effects; candidate implements only title/description/status and atomic event audit.",
    "Convex propagation is subscription latency; Django has no equivalent task subscription in this current UI, so no realtime speedup ratio is reported.",
    "Read byte count is parsed JSON serialization for Convex versus raw JSON body for Django; excludes protocol headers/envelopes.",
    "Warm reads and sequential writes, no cold-start or sustained-load claim.",
  ],
  bytes: { django: djangoBytes, convex: convexBytes },
  summaries,
  samples,
};
writeFileSync(`${directory}/comparison.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ summaries, bytes: result.bytes }, null, 2));
