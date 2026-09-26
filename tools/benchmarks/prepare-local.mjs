import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const directory = process.env.BENCH_ARTIFACT_DIR ?? "/tmp/summon-migration-control";
const container = process.env.DJANGO_BENCH_CONTAINER ?? "summon-core-system-api-run-856c63434ab4";
const slug = `migration-bench-${Date.now()}`;
const password = randomBytes(32).toString("base64url");
mkdirSync(directory, { recursive: true, mode: 0o700 });
// Exclusive creation prevents accidentally overwriting a previous run's credentials.
writeFileSync(resolve(directory, "benchmark-private.json"), JSON.stringify({ slug, password }), {
  mode: 0o600,
  flag: "wx",
});
execFileSync("docker", [
  "cp",
  resolve(import.meta.dirname, "seed_django.py"),
  `${container}:/tmp/seed_migration_benchmark.py`,
]);
const output = execFileSync(
  "docker",
  [
    "exec",
    "-e",
    "SUMMON_BENCH_PASSWORD",
    "-e",
    "SUMMON_BENCH_SLUG",
    container,
    "python",
    "manage.py",
    "shell",
    "-c",
    "exec(open('/tmp/seed_migration_benchmark.py').read())",
  ],
  { encoding: "utf8", env: { ...process.env, SUMMON_BENCH_PASSWORD: password, SUMMON_BENCH_SLUG: slug } }
);
const fixture = JSON.parse(output.trim().split("\n").at(-1));
writeFileSync(resolve(directory, "django-fixture.json"), JSON.stringify(fixture, null, 2));
console.log(`Created isolated 500-task fixture. Run artifacts: ${directory}`);
