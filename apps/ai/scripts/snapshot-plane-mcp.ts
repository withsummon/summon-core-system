/**
 * Writes `src/plane-mcp-tools.json`: the tools of the pinned Plane MCP server, which the Summon MCP
 * server re-exposes. Rerun when the image in the compose files changes, then run `scripts/smoke-mcp.ts`.
 *
 * Plane MCP is written for Plane Cloud and Commercial. Summon runs Plane Community, whose `/api/v1` has
 * no pages, customers, releases, initiatives, milestones, templates, work logs, work item types or
 * properties, relations, estimates, feature toggles or PQL; calling them answers 404 (PQL: 400). The
 * snapshot leaves those out so MCP clients only see what works here.
 *
 *   PLANE_MCP_URL=http://localhost:8211/mcp/http/api-key/mcp PLANE_API_KEY=… PLANE_WORKSPACE_SLUG=… \
 *     bun scripts/snapshot-plane-mcp.ts makeplane/plane-mcp-server:v0.3.1
 */
import path from "node:path";
import { parseRpcBody, type PlaneTool, withoutActions } from "../src/plane-mcp";

const [image] = process.argv.slice(2);
const url = process.env.PLANE_MCP_URL;
const apiKey = process.env.PLANE_API_KEY;
const workspaceSlug = process.env.PLANE_WORKSPACE_SLUG;
if (!image || !url || !apiKey || !workspaceSlug) {
  throw new Error("Usage: PLANE_MCP_URL, PLANE_API_KEY, PLANE_WORKSPACE_SLUG and the image tag are required");
}

const UNSUPPORTED_TOOLS = new Set([
  "collection",
  "customer",
  "customer_property",
  "customer_request",
  "get_pql_reference",
  "initiative",
  "milestone",
  "page",
  "project_estimate",
  "release",
  "release_label",
  "release_tag",
  "template",
  "work_log",
  "workitem_property",
  "workitem_relation",
  "workitem_type",
  "workspace",
]);
const UNSUPPORTED_ACTIONS: Readonly<Record<string, ReadonlyArray<string>>> = {
  project: ["get_features", "update_features"],
  workitem: ["count"],
};
const UNSUPPORTED_INPUTS = ["pql"];

/** One tool without what this Plane can't serve: unsupported actions (enum and description lines) and inputs. */
const supported = (tool: PlaneTool): PlaneTool => {
  const actions = UNSUPPORTED_ACTIONS[tool.name] ?? [];
  const trimmed = withoutActions(tool, actions);
  const properties = trimmed.inputSchema.properties as Readonly<Record<string, unknown>>;
  const inputs = UNSUPPORTED_INPUTS.filter((name) => name in properties);
  const removed = [...actions, ...inputs];
  if (removed.length === 0) return trimmed;
  return {
    ...trimmed,
    ...(trimmed.description
      ? { description: `${trimmed.description}\n\nNot available on this Plane: ${removed.join(", ")}.` }
      : {}),
    inputSchema: {
      ...trimmed.inputSchema,
      properties: Object.fromEntries(Object.entries(properties).filter(([name]) => !inputs.includes(name))),
    },
  };
};

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

const tools: Array<PlaneTool> = [];
let cursor: string | undefined;
do {
  // Each page's cursor comes from the previous one.
  // oxlint-disable-next-line no-await-in-loop
  const page = await rpc({ id: 2, method: "tools/list", params: cursor ? { cursor } : {} });
  if (!page?.result) throw new Error(`tools/list failed: ${JSON.stringify(page?.error)}`);
  for (const tool of page.result.tools as typeof tools) {
    if (UNSUPPORTED_TOOLS.has(tool.name)) continue;
    tools.push(
      supported({
        name: tool.name,
        ...(tool.description ? { description: tool.description } : {}),
        inputSchema: tool.inputSchema,
      })
    );
  }
  cursor = page.result.nextCursor as string | undefined;
} while (cursor);

tools.sort((a, b) => a.name.localeCompare(b.name));
const out = path.resolve(import.meta.dir, "../src/plane-mcp-tools.json");
await Bun.write(out, `${JSON.stringify({ server: image, tools }, null, 2)}\n`);
console.log(`${tools.length} Plane MCP tools from ${image} → src/plane-mcp-tools.json`);
