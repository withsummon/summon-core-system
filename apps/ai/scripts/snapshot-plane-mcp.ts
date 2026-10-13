/**
 * Writes `src/plane-mcp-tools.json`: the tools of the pinned Plane MCP server, which the Summon MCP
 * server re-exposes. Rerun when the image in the compose files changes.
 *
 *   PLANE_MCP_URL=http://localhost:8211/mcp/http/api-key/mcp PLANE_API_KEY=… PLANE_WORKSPACE_SLUG=… \
 *     bun scripts/snapshot-plane-mcp.ts makeplane/plane-mcp-server:v0.3.1
 */
import path from "node:path";
import { parseRpcBody } from "../src/plane-mcp";

const [image] = process.argv.slice(2);
const url = process.env.PLANE_MCP_URL;
const apiKey = process.env.PLANE_API_KEY;
const workspaceSlug = process.env.PLANE_WORKSPACE_SLUG;
if (!image || !url || !apiKey || !workspaceSlug) {
  throw new Error("Usage: PLANE_MCP_URL, PLANE_API_KEY, PLANE_WORKSPACE_SLUG and the image tag are required");
}

let session: Record<string, string> = {};
const rpc = async (body: Record<string, unknown>) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
      authorization: `Bearer ${apiKey}`,
      "x-workspace-slug": workspaceSlug,
      ...session,
    },
    body: JSON.stringify({ jsonrpc: "2.0", ...body }),
  });
  if (!response.ok) throw new Error(`${body.method}: HTTP ${response.status} ${await response.text()}`);
  const id = response.headers.get("mcp-session-id");
  if (id) session = { "mcp-session-id": id };
  return "id" in body
    ? (parseRpcBody(await response.text()) as { result?: Record<string, unknown>; error?: unknown })
    : undefined;
};

await rpc({
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "summon-snapshot", version: "1" } },
});
await rpc({ method: "notifications/initialized" });

const tools: Array<{ name: string; description?: string; inputSchema: unknown }> = [];
let cursor: string | undefined;
do {
  // Each page's cursor comes from the previous one.
  // oxlint-disable-next-line no-await-in-loop
  const page = await rpc({ id: 2, method: "tools/list", params: cursor ? { cursor } : {} });
  if (!page?.result) throw new Error(`tools/list failed: ${JSON.stringify(page?.error)}`);
  for (const tool of page.result.tools as typeof tools) {
    tools.push({
      name: tool.name,
      ...(tool.description ? { description: tool.description } : {}),
      inputSchema: tool.inputSchema,
    });
  }
  cursor = page.result.nextCursor as string | undefined;
} while (cursor);

tools.sort((a, b) => a.name.localeCompare(b.name));
const out = path.resolve(import.meta.dir, "../src/plane-mcp-tools.json");
await Bun.write(out, `${JSON.stringify({ server: image, tools }, null, 2)}\n`);
console.log(`${tools.length} Plane MCP tools from ${image} → src/plane-mcp-tools.json`);
