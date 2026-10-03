import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
const directory = process.env.BENCH_ARTIFACT_DIR ?? "/tmp/summon-migration-control";
const config = JSON.parse(readFileSync(`${directory}/benchmark-private.json`, "utf8"));
const email = `${config.slug}@example.test`;
const client = new ConvexHttpClient("http://127.0.0.1:3210", { logger: false });
const result = await client.action(api.auth.signIn, {
  provider: "password",
  params: { email, password: config.password, flow: "signUp" },
});
if (!result.tokens?.token) throw new Error("Password signup did not return a JWT");
client.setAuth(result.tokens.token);
const workspaces = await client.query(api.workspaces.index.list, {});
writeFileSync(`${directory}/convex-session-private.json`, JSON.stringify(result.tokens), { mode: 0o600 });
console.log(JSON.stringify({ authenticated: true, workspaceCount: workspaces.length }));
