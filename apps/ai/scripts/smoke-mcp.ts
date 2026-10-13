/**
 * Live smoke test of the Summon MCP server: calls every Summon tool and every Plane tool's main actions
 * through `/ai/mcp`, chaining ids from creates into reads, updates and deletes, and cleans up after itself.
 * Run it against a disposable copy of the database; it writes and deletes real rows.
 *
 *   SUMMON_API_KEY=… SUMMON_WORKSPACE_SLUG=… [SUMMON_MCP_URL=http://localhost:3300/ai/mcp] \
 *     [SMOKE_PAGE_ID=<project page without Summon context>] bun scripts/smoke-mcp.ts
 *
 * Exits non-zero when a tool fails or a listed tool is never called. A step may name the domain refusal
 * it expects (such as 409 for a duplicate): that still proves the tool reached its endpoint.
 */
import { parseRpcBody } from "../src/plane-mcp";

const url = process.env.SUMMON_MCP_URL ?? "http://localhost:3300/ai/mcp";
const apiKey = process.env.SUMMON_API_KEY;
const workspaceSlug = process.env.SUMMON_WORKSPACE_SLUG;
const pageId = process.env.SMOKE_PAGE_ID;
if (!apiKey || !workspaceSlug) throw new Error("SUMMON_API_KEY and SUMMON_WORKSPACE_SLUG are required");

type Json = any; // Tool results are whatever each endpoint returns; the script only reads ids from them.
type Rpc = { result?: { content?: Array<{ text?: string }>; isError?: boolean; tools?: Array<{ name: string }> } };

let session: Record<string, string> = {};
const rpc = async (body: Record<string, unknown>): Promise<Rpc> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${apiKey}`,
      "x-workspace-slug": workspaceSlug,
      ...session,
    },
    body: JSON.stringify({ jsonrpc: "2.0", ...body }),
  });
  const id = response.headers.get("mcp-session-id");
  if (id) session = { "mcp-session-id": id };
  const text = await response.text();
  return "id" in body ? (parseRpcBody(text) as Rpc) : {};
};

const runs: Array<{ tool: string; ok: boolean; ms: number; note: string }> = [];

/** Calls one tool; `expect` is the HTTP status of a domain refusal that still counts as working. */
const call = async (tool: string, args: Record<string, unknown> = {}, expect?: number): Promise<Json> => {
  const startedAt = performance.now();
  const { result } = await rpc({ id: 3, method: "tools/call", params: { name: tool, arguments: args } });
  const ms = Math.round(performance.now() - startedAt);
  const text = result?.content?.[0]?.text ?? "";
  let body: Json;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  // Plane reports some failures as plain "Error…" text without isError.
  const failed = !result || result.isError || (typeof body === "string" && body.startsWith("Error"));
  const ok = !failed || (expect !== undefined && body?.status === expect);
  runs.push({ tool, ok, ms, note: failed ? text.slice(0, 160) : "" });
  return body;
};

await rpc({
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "summon-smoke", version: "1" } },
});
await rpc({ method: "notifications/initialized" });
const listed = (await rpc({ id: 2, method: "tools/list" })).result?.tools?.map((tool) => tool.name) ?? [];

const tag = Date.now().toString(36);
const project = (await call("plane_project", { action: "list" })).results[0].id;
const me = await call("plane_member", { action: "me" });

// Read-only Summon tools.
await Promise.all(
  ["home_summary", "ai_status", "workspace_settings_get", "mcp_status", "access_me", "users_get"].map((tool) =>
    call(tool)
  )
);
await call("users_history");
await call("report_summary", { project_id: project });
await call("assistant_query", { intent: "status", project_id: project });
await Promise.all(
  ["project_people_get", "project_profile_get", "project_overview"].map((tool) => call(tool, { project_id: project }))
);
await call("project_profile_post", { project_id: project }, 409);
await call("project_profile_patch", { project_id: project, health: "on_track" });
const conversation = (await call("assistant_conversation_list"))[0];
if (conversation) {
  await call("assistant_conversation_get", { pk: conversation.id });
  await call("assistant_message_list", { conversation_id: conversation.id });
  await call("assistant_attachment_list", { conversation_id: conversation.id });
}

// Clients, contacts and opportunities.
const client = await call("client_create", { name: `Smoke client ${tag}` });
await call("client_create", { name: `Smoke client ${tag}` }, 409);
await call("client_list");
await call("client_get", { pk: client.id });
await call("client_update", { pk: client.id, notes: "smoke" });
const contact = await call("client_contact_create", {
  client_id: client.id,
  name: "Smoke",
  email: `${tag}@example.test`,
});
await call("client_contact_list", { client_id: client.id });
await call("client_contact_get", { client_id: client.id, pk: contact.id });
await call("client_contact_update", { client_id: client.id, pk: contact.id, title: "CTO" });
await call("client_contact_delete", { client_id: client.id, pk: contact.id });
const opportunity = await call("opportunity_create", { title: `Smoke opportunity ${tag}`, client: client.id });
await call("opportunity_list");
await call("opportunity_get", { pk: opportunity.id });
await call("opportunity_update", { pk: opportunity.id, value: "1000" });
await call("opportunity_transition", { pk: opportunity.id, stage: "won" });
// The project already belongs to a client, so Django refuses the hand-off: the route and rule still ran.
await call("opportunity_delivery", { pk: opportunity.id, project }, 409);
await call("opportunity_delete", { pk: opportunity.id });

// Meetings, resources and automation.
const meeting = await call("meeting_create", { title: `Smoke ${tag}`, starts_at: new Date().toISOString(), project });
await call("meeting_list");
await call("meeting_get", { pk: meeting.id });
await call("meeting_update", { pk: meeting.id, agenda: "smoke" });
await call("meeting_summary", { meeting_id: meeting.id, transcript_source: "text" }, 400); // no transcript yet
const resource = await call("resource_create", { title: `Smoke ${tag}`, url: `https://example.test/${tag}`, project });
await call("resource_list");
await call("resource_get", { pk: resource.id });
await call("resource_update", { pk: resource.id, description: "smoke" });
await call("resource_delete", { pk: resource.id });
const template = await call("automation_template_create", {
  name: `Smoke ${tag}`,
  type: "status_report",
  content_template: "# {{ project.name }}",
});
await call("automation_template_list");
await call("automation_template_get", { pk: template.id });
await call("automation_template_update", { pk: template.id, description: "smoke" });
// Without a configured model Django answers 503 but still saves the failed job.
const job = await call("automation_job_create", { template: template.id, project }, 503);
const jobBody = job?.error ?? job;
await call("automation_job_list");
await call("automation_job_get", { job_id: jobBody.id });
await call("automation_job_publish", { job_id: jobBody.id }, jobBody.status === "completed" ? undefined : 400);
if (pageId) {
  const context = await call("page_context_create", { page: pageId, project, category: "notes" });
  await call("page_context_list");
  await call("page_context_get", { pk: context.id });
  await call("page_context_update", { pk: context.id, tags: ["smoke"] });
  await call("page_context_delete", { pk: context.id });
}

// Plane tools.
const item = await call("plane_workitem", { action: "create", project_id: project, name: `Smoke ${tag}` });
await call("meeting_work_item_create", { meeting_id: meeting.id, issue: item.id });
const links = await call("meeting_work_item_list", { meeting_id: meeting.id });
await call("meeting_work_item_delete", { meeting_id: meeting.id, pk: links[0]?.id });
await call("meeting_delete", { pk: meeting.id });
await call("plane_workitem", { action: "list", project_id: project });
await call("plane_workitem", { action: "search", query: "Smoke" });
await call("plane_workitem", { action: "update", project_id: project, workitem_id: item.id, priority: "high" });
await call("plane_workitem", {
  action: "manage_assignee",
  project_id: project,
  workitem_id: item.id,
  add_user_id: me.id,
});
const label = await call("plane_label", { action: "create", project_id: project, name: `smoke-${tag}`, color: "#f00" });
await call("plane_workitem", {
  action: "manage_label",
  project_id: project,
  workitem_id: item.id,
  add_label_id: label.id,
});
const comment = await call("plane_workitem_comment", {
  action: "create",
  project_id: project,
  workitem_id: item.id,
  comment_html: "<p>smoke</p>",
});
await call("plane_workitem_comment", {
  action: "delete",
  project_id: project,
  workitem_id: item.id,
  comment_id: comment.id,
});
const link = await call("plane_workitem_link", {
  action: "create",
  project_id: project,
  workitem_id: item.id,
  url: `https://example.test/${tag}`,
});
await call("plane_workitem_link", { action: "delete", project_id: project, workitem_id: item.id, link_id: link.id });
await call("plane_workitem_activity", { action: "list", project_id: project, workitem_id: item.id });
await call("plane_workitem_attachment", { action: "list", project_id: project, workitem_id: item.id });
const module = await call("plane_module", { action: "create", project_id: project, name: `Smoke ${tag}` });
await call("plane_module", { action: "manage_workitems", project_id: project, module_id: module.id, add_ids: item.id });
await call("plane_module", { action: "delete", project_id: project, module_id: module.id });
const state = await call("plane_state", {
  action: "create",
  project_id: project,
  name: `Smoke ${tag}`,
  color: "#123",
  group: "backlog",
});
await call("plane_state", { action: "delete", project_id: project, state_id: state.id });
await call("plane_cycle", { action: "list", project_id: project });
await call("plane_intake", { action: "list", project_id: project });
await call("plane_workitem", { action: "delete", project_id: project, workitem_id: item.id });
await call("plane_label", { action: "delete", project_id: project, label_id: label.id });
await call("automation_template_delete", { pk: template.id });
await call("client_delete", { pk: client.id });

const called = new Set(runs.map((run) => run.tool));
const skipped = listed.filter((tool) => !called.has(tool) && !(tool.startsWith("page_context_") && !pageId));
for (const run of runs)
  console.log(`${run.ok ? "ok  " : "FAIL"} ${String(run.ms).padStart(5)}ms ${run.tool} ${run.note}`);
const ms = runs.map((run) => run.ms).toSorted((a, b) => a - b);
const failed = runs.filter((run) => !run.ok);
console.log(
  `${runs.length - failed.length}/${runs.length} calls ok across ${called.size}/${listed.length} tools; ` +
    `p50 ${ms[Math.floor(ms.length / 2)]}ms, p95 ${ms[Math.floor(ms.length * 0.95)]}ms` +
    (skipped.length ? `; never called: ${skipped.join(", ")}` : "")
);
if (failed.length || skipped.length) process.exit(1);
