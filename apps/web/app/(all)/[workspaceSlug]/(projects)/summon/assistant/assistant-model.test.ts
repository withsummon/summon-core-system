import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const modelSource = readFileSync(new URL("./assistant-model.ts", import.meta.url), "utf8");
const modelUrl = `data:text/javascript;base64,${Buffer.from(
  ts.transpileModule(modelSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
  }).outputText
).toString("base64")}`;
// SAFETY: The loaded module is a direct TypeScript transpilation of assistant-model.ts above.
const model = (await import(modelUrl)) as typeof import("./assistant-model");
const {
  ASSISTANT_TEMPLATES,
  EMPTY_COMPOSER,
  attachmentProblem,
  meetingProjectFor,
  openChat,
  projectForScope,
  WORKSPACE_SCOPE,
  buildTimeline,
  conversationScopePatch,
  groupConversations,
  scopeContext,
  scopeFromConversation,
  titleFromAnswer,
  toolPayload,
  toolProblem,
} = model;

type TConversation = Parameters<typeof groupConversations>[0][number];
type TMessage = Parameters<typeof buildTimeline>[0][number];
type TAction = Parameters<typeof buildTimeline>[1][number];

test("a chat's saved project or client becomes its scope and round-trips to the PATCH body", () => {
  assert.deepEqual(scopeFromConversation({ project: "p1", client: "c1" }), { kind: "project", id: "p1" });
  assert.deepEqual(scopeFromConversation({ project: null, client: "c1" }), { kind: "client", id: "c1" });
  assert.deepEqual(scopeFromConversation({ project: null, client: null }), WORKSPACE_SCOPE);

  assert.deepEqual(conversationScopePatch({ kind: "client", id: "c1" }), { project: null, client: "c1" });
  // Meetings focus messages only; the conversation forgets any saved project or client.
  assert.deepEqual(conversationScopePatch({ kind: "meeting", id: "m1" }), { project: null, client: null });
});

test("scope context carries exactly one focus, and a meeting brings its project", () => {
  const base = { pageIds: ["page-1"], workspaceSummary: true };
  assert.deepEqual(scopeContext({ ...base, scope: { kind: "project", id: "p1" } }), {
    workspace: true,
    project_id: "p1",
    client_id: undefined,
    meeting_id: undefined,
    page_ids: ["page-1"],
  });
  const meeting = scopeContext({ ...base, scope: { kind: "meeting", id: "m1" } }, "p9");
  assert.equal(meeting.project_id, "p9");
  assert.equal(meeting.meeting_id, "m1");
  const client = scopeContext({ ...base, scope: { kind: "client", id: "c1" } });
  assert.equal(client.project_id, undefined);
  assert.equal(client.client_id, "c1");
  assert.equal(scopeContext({ ...base, scope: WORKSPACE_SCOPE }).project_id, undefined);
});

test("Plane MCP tools explain what is missing before sending", () => {
  const project = { kind: "project" as const, id: "p1" };
  assert.equal(toolProblem(EMPTY_COMPOSER), "");
  assert.match(toolProblem({ ...EMPTY_COMPOSER, toolMode: "list_projects" }), /credential/);
  assert.match(
    toolProblem({ ...EMPTY_COMPOSER, toolMode: "create_work_item", mcpCredentialId: "k" }),
    /Scope the chat to a project/
  );
  assert.match(
    toolProblem({ ...EMPTY_COMPOSER, toolMode: "add_comment", mcpCredentialId: "k", scope: project }),
    /work item ID/
  );
  assert.equal(
    toolProblem({ ...EMPTY_COMPOSER, toolMode: "add_comment", mcpCredentialId: "k", scope: project, workItemId: "7" }),
    ""
  );
});

test("each tool maps to the endpoint's tool and arguments", () => {
  const state = { ...EMPTY_COMPOSER, scope: { kind: "project" as const, id: "p1" }, workItemId: " w1 " };
  assert.deepEqual(toolPayload({ ...state, toolMode: "chat" }, "hi"), {});
  assert.deepEqual(toolPayload({ ...state, toolMode: "list_projects" }, ""), {
    tool: "project",
    arguments: { action: "list" },
  });
  assert.deepEqual(toolPayload({ ...state, toolMode: "create_work_item" }, "Fix login"), {
    tool: "workitem",
    arguments: { action: "create", project_id: "p1", name: "Fix login" },
  });
  assert.deepEqual(toolPayload({ ...state, toolMode: "add_comment" }, "<p>Done</p>"), {
    tool: "workitem_comment",
    arguments: { action: "create", project_id: "p1", work_item_id: "w1", comment_html: "<p>Done</p>" },
  });
});

test("timeline interleaves messages, actions and write-backs by time", () => {
  const message = (id: string, at: string) => ({ id, created_at: at }) as TMessage;
  const action = (id: string, at: string) => ({ id, created_at: at }) as TAction;
  const items = buildTimeline(
    [message("m2", "2026-10-14T10:02:00Z"), message("m1", "2026-10-14T10:00:00Z")],
    [action("a1", "2026-10-14T10:01:00Z")],
    [{ id: "w1", kind: "task", messageId: "m2", created_at: "2026-10-14T10:03:00Z" }]
  );
  assert.deepEqual(
    items.map((item) => item.type),
    ["message", "action", "message", "writeback"]
  );
});

const daysAgo = (days: number) => new Date(2026, 9, 14 - days, 9, 0).toISOString();
const conversation = (id: string, days: number) => ({ id, last_activity_at: daysAgo(days) }) as TConversation;

test("history groups into Today, Previous 7 days and Older, dropping empty groups", () => {
  const now = new Date(2026, 9, 14, 15, 0);
  const groups = groupConversations([conversation("a", 0), conversation("b", 3), conversation("c", 30)], now);
  assert.deepEqual(
    groups.map((group) => [group.label, group.conversations.map((item) => item.id)]),
    [
      ["Today", ["a"]],
      ["Previous 7 days", ["b"]],
      ["Older", ["c"]],
    ]
  );
  assert.deepEqual(
    groupConversations([conversation("a", 0)], now).map((group) => group.label),
    ["Today"]
  );
});

test("write-back titles come from the answer's first line without markdown", () => {
  assert.equal(titleFromAnswer("## **AURA** status digest\n\nBody", "Fallback"), "AURA status digest");
  assert.equal(titleFromAnswer("- `AURA-4` overdue", "Fallback"), "AURA-4 overdue");
  assert.equal(titleFromAnswer("\n\n", "Fallback"), "Fallback");
  assert.equal(titleFromAnswer("x".repeat(200), "Fallback").length, 118);
});

test("every template needs one scope and names the chosen record in its prompt", () => {
  for (const template of ASSISTANT_TEMPLATES) {
    assert.ok(["project", "client", "meeting"].includes(template.scope));
    assert.match(template.prompt("AURA Credit Scoring"), /AURA Credit Scoring/);
  }
  // The backend only starts the document flow for a generate + document request.
  const documentTemplate = ASSISTANT_TEMPLATES.find((template) => template.id === "generate-document");
  assert.match(documentTemplate?.prompt("AURA") ?? "", /^Generate a document/);
});

test("attachments are checked for count, type, emptiness and size before upload", () => {
  const mb = 1024 * 1024;
  assert.equal(attachmentProblem([{ name: "brief.PDF", size: mb }], 0, 5), "");
  assert.equal(attachmentProblem([{ name: "call.m4a", size: 200 * mb }], 4, 5), "");
  assert.match(attachmentProblem([{ name: "a.pdf", size: 1 }], 5, 5), /up to 5 files/);
  assert.match(attachmentProblem([{ name: "run.exe", size: 1 }], 0, 5), /run\.exe: unsupported/);
  assert.match(attachmentProblem([{ name: "empty.md", size: 0 }], 0, 5), /unsupported or empty/);
  assert.match(attachmentProblem([{ name: "big.docx", size: 11 * mb }], 0, 5), /10 MB/);
  assert.match(attachmentProblem([{ name: "long.mp3", size: 251 * mb }], 0, 5), /250 MB/);
  assert.equal(model.ATTACHMENT_ACCEPT, ".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.mp3,.m4a");
});

test("a new chat shows nothing even while the previous conversation is cached", () => {
  const cached = {
    messages: [{ id: "m1" }] as TMessage[],
    actions: [{ id: "a1" }] as TAction[],
    attachments: [
      { id: "sent", message: "m1" },
      { id: "waiting", message: null },
    ] as NonNullable<Parameters<typeof openChat>[1]>["attachments"],
  };
  assert.deepEqual(openChat("", cached), { messages: [], actions: [], pendingAttachments: [] });
  const open = openChat("c1", cached);
  assert.equal(open.messages.length, 1);
  assert.equal(open.actions.length, 1);
  assert.deepEqual(
    open.pendingAttachments.map((attachment) => attachment.id),
    ["waiting"]
  );
});

test("write-backs and requests file into the scope's project, or the meeting's project", () => {
  const meetings = [{ id: "m1", project: "p9" }];
  assert.equal(projectForScope({ kind: "project", id: "p1" }), "p1");
  assert.equal(meetingProjectFor({ kind: "meeting", id: "m1" }, meetings), "p9");
  assert.equal(projectForScope({ kind: "meeting", id: "m1" }, "p9"), "p9");
  assert.equal(projectForScope({ kind: "client", id: "c1" }, "p9"), undefined);
  assert.equal(meetingProjectFor({ kind: "project", id: "p1" }, meetings), undefined);
});
