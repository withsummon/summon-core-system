import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const directory = process.env.BENCH_ARTIFACT_DIR ?? "/tmp/summon-migration-control";
const config = JSON.parse(readFileSync(`${directory}/benchmark-private.json`, "utf8"));
const fixture = JSON.parse(readFileSync(`${directory}/django-fixture.json`, "utf8"));
const origin = process.env.DJANGO_BENCH_ORIGIN ?? "http://localhost:8002";
const cookies = new Map();
async function request(path, options = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...options,
    redirect: "manual",
    headers: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "), ...options.headers },
  });
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    cookies.set(pair.slice(0, index), pair.slice(index + 1));
  }
  return response;
}
const csrfResponse = await request("/auth/get-csrf-token/");
assert.equal(csrfResponse.status, 200);
const csrfData = await csrfResponse.json();
const csrf = csrfData.csrf_token ?? csrfData.csrfToken;
assert.equal(typeof csrf, "string");
const response = await request("/auth/sign-in/", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: origin,
    Referer: `${origin}/`,
  },
  body: new URLSearchParams({ email: fixture.email, password: config.password, csrfmiddlewaretoken: csrf }),
});
console.log({ loginStatus: response.status, location: response.headers.get("location") });
const user = await request("/api/users/me/");
assert.equal(user.status, 200, await user.text());
const tasks = await request(`/api/workspaces/${fixture.slug}/projects/${fixture.projectId}/issues/?per_page=50`);
const data = await tasks.json();
assert.equal(tasks.status, 200, JSON.stringify(data));
console.log({ authenticated: true, taskResponseKeys: Object.keys(data), rows: data.results?.length });
writeFileSync(
  `${directory}/django-session-private.json`,
  JSON.stringify({
    cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
    csrf: cookies.get("csrftoken") ?? csrf,
  }),
  { mode: 0o600 }
);
