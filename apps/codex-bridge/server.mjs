import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PORT = Number(process.env.PORT || 8090);
const WORKSPACE = process.env.CODEX_WORKSPACE || "/workspace";
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const VALID_ROLES = new Set(["assistant", "user"]);

export function validateGenerateRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("request must be an object");
  if (typeof value.model !== "string" || !value.model.trim()) throw new Error("model is required");
  if (value.model.length > 100) throw new Error("model is too long");
  if (typeof value.system !== "string") throw new Error("system must be a string");
  if (
    !Array.isArray(value.messages) ||
    value.messages.length > 100 ||
    value.messages.some(
      (message) =>
        !message || typeof message !== "object" || !VALID_ROLES.has(message.role) || typeof message.content !== "string"
    )
  ) {
    throw new Error("messages are invalid");
  }
  if (
    value.response_schema !== null &&
    (typeof value.response_schema !== "object" || Array.isArray(value.response_schema))
  ) {
    throw new Error("response_schema is invalid");
  }
  return value;
}

export function buildPrompt({ system, messages }) {
  return `System instructions:\n${system}\n\nConversation:\n${JSON.stringify(messages)}`;
}

export function buildCodexArgs({ model, outputPath, schemaPath }) {
  return [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--cd",
    WORKSPACE,
    ...(model === "default" ? [] : ["--model", model]),
    ...(schemaPath ? ["--output-schema", schemaPath] : []),
    "--output-last-message",
    outputPath,
    "-",
  ];
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("request is too large"), { status: 413, code: "context_too_large" }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function runProcess(args, input, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn("codex", args, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stderr.on("data", (chunk) => {
      if (stderr.length < 16_384) stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(Object.assign(new Error("Codex timed out"), { status: 504, code: "timeout" }));
        return;
      }
      if (exitCode === 0) {
        resolve();
        return;
      }
      const normalized = stderr.toLowerCase();
      const authenticationFailed = normalized.includes("not logged in") || normalized.includes("login required");
      const rateLimited = normalized.includes("rate limit") || normalized.includes("too many requests");
      reject(
        Object.assign(new Error("Codex execution failed"), {
          status: authenticationFailed ? 401 : rateLimited ? 429 : 502,
          code: authenticationFailed ? "authentication_failed" : rateLimited ? "rate_limited" : "unavailable",
        })
      );
    });
    child.stdin.end(input);
  });
}

async function generate(value) {
  const request = validateGenerateRequest(value);
  const directory = await mkdtemp(join(tmpdir(), "summon-codex-"));
  const outputPath = join(directory, "output.txt");
  const schemaPath = request.response_schema ? join(directory, "schema.json") : null;
  try {
    if (schemaPath) await writeFile(schemaPath, JSON.stringify(request.response_schema), { mode: 0o600 });
    await runProcess(
      buildCodexArgs({ model: request.model, outputPath, schemaPath }),
      buildPrompt(request),
      Number(process.env.CODEX_TIMEOUT_MS || 120_000)
    );
    const text = await readFile(outputPath, "utf8");
    if (!text)
      throw Object.assign(new Error("Codex returned an empty response"), { status: 502, code: "invalid_response" });
    return { text, model: request.model, usage: null };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

export const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    send(response, 200, { status: "ok" });
    return;
  }
  if (request.method !== "POST" || request.url !== "/generate") {
    send(response, 404, { code: "not_found" });
    return;
  }
  try {
    const body = JSON.parse(await readBody(request));
    send(response, 200, await generate(body));
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : error instanceof SyntaxError ? 400 : 502;
    const code = typeof error?.code === "string" ? error.code : status === 400 ? "invalid_request" : "unavailable";
    send(response, status, { code });
  }
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(PORT, "0.0.0.0");
}
