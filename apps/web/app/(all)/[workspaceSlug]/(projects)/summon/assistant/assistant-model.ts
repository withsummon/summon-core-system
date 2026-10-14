/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Pure Assistant view model: no runtime imports, so the unit tests can load it directly.
import type {
  ISummonAssistantAction,
  ISummonAssistantAttachment,
  ISummonAssistantConversation,
  ISummonAssistantMessage,
  ISummonAssistantMessageRequest,
} from "@plane/types";

/** What a chat is about. One scope at a time, always shown in the composer and the chat header. */
export type TAssistantScopeKind = "workspace" | "project" | "client" | "meeting";
export type TAssistantScope = { kind: TAssistantScopeKind; id: string };
export const WORKSPACE_SCOPE: TAssistantScope = { kind: "workspace", id: "" };

/** Plane MCP operations the backend accepts; `chat` is the ordinary grounded answer. */
export type TAssistantToolMode =
  | "chat"
  | "list_projects"
  | "create_project"
  | "list_work_items"
  | "create_work_item"
  | "update_work_item"
  | "add_comment";

export interface AssistantComposerState {
  content: string;
  scope: TAssistantScope;
  pageIds: string[];
  workspaceSummary: boolean;
  toolMode: TAssistantToolMode;
  mcpCredentialId: string;
  workItemId: string;
}

export const EMPTY_COMPOSER: AssistantComposerState = {
  content: "",
  scope: WORKSPACE_SCOPE,
  pageIds: [],
  workspaceSummary: false,
  toolMode: "chat",
  mcpCredentialId: "",
  workItemId: "",
};

/** A chat remembers its project or client on the server; anything else starts at workspace scope. */
export function scopeFromConversation(
  conversation: Pick<ISummonAssistantConversation, "project" | "client">
): TAssistantScope {
  if (conversation.project) return { kind: "project", id: conversation.project };
  if (conversation.client) return { kind: "client", id: conversation.client };
  return WORKSPACE_SCOPE;
}

export function conversationScopePatch(
  scope: TAssistantScope
): Pick<ISummonAssistantConversation, "project" | "client"> {
  return {
    project: scope.kind === "project" ? scope.id : null,
    client: scope.kind === "client" ? scope.id : null,
  };
}

/** The project a scope files into: the project itself, or the meeting's project. */
export function projectForScope(scope: TAssistantScope, meetingProjectId?: string | null) {
  const projectByKind: Partial<Record<TAssistantScopeKind, string | null | undefined>> = {
    project: scope.id,
    meeting: meetingProjectId,
  };
  return projectByKind[scope.kind] || undefined;
}

export const meetingProjectFor = (scope: TAssistantScope, meetings: Array<{ id: string; project?: string | null }>) =>
  scope.kind === "meeting" ? meetings.find((meeting) => meeting.id === scope.id)?.project : undefined;

export function scopeContext(
  state: Pick<AssistantComposerState, "scope" | "pageIds" | "workspaceSummary">,
  meetingProjectId?: string | null
): ISummonAssistantMessageRequest["context"] {
  const { scope } = state;
  return {
    workspace: state.workspaceSummary,
    project_id: projectForScope(scope, meetingProjectId),
    client_id: scope.kind === "client" ? scope.id : undefined,
    meeting_id: scope.kind === "meeting" ? scope.id : undefined,
    page_ids: state.pageIds,
  };
}

const PROJECT_TOOLS = new Set<TAssistantToolMode>([
  "list_work_items",
  "create_work_item",
  "update_work_item",
  "add_comment",
]);
const WORK_ITEM_TOOLS = new Set<TAssistantToolMode>(["update_work_item", "add_comment"]);

export const TOOL_LABELS: Record<Exclude<TAssistantToolMode, "chat">, string> = {
  list_projects: "List projects",
  create_project: "Create a project",
  list_work_items: "List work items",
  create_work_item: "Create a work item",
  update_work_item: "Rename a work item",
  add_comment: "Comment on a work item",
};

export const toolNeedsWorkItem = (mode: TAssistantToolMode) => WORK_ITEM_TOOLS.has(mode);

/** Validate a Plane MCP request; returns a message for the person, or "" when it can be sent. */
export function toolProblem(state: AssistantComposerState): string {
  if (state.toolMode === "chat") return "";
  if (!state.mcpCredentialId) return "Choose a Plane MCP credential for this tool.";
  if (PROJECT_TOOLS.has(state.toolMode) && state.scope.kind !== "project") return "Scope the chat to a project first.";
  if (WORK_ITEM_TOOLS.has(state.toolMode) && !state.workItemId.trim()) return "Enter the work item ID.";
  return "";
}

/** The `tool` + `arguments` the message endpoint expects for each Plane MCP operation. */
export function toolPayload(
  state: AssistantComposerState,
  content: string
): Pick<ISummonAssistantMessageRequest, "tool" | "arguments"> {
  const projectId = state.scope.kind === "project" ? state.scope.id : "";
  const workItemId = state.workItemId.trim();
  switch (state.toolMode) {
    case "list_projects":
      return { tool: "project", arguments: { action: "list" } };
    case "create_project":
      return { tool: "project", arguments: { action: "create", name: content } };
    case "list_work_items":
      return { tool: "workitem", arguments: { action: "list", project_id: projectId } };
    case "create_work_item":
      return { tool: "workitem", arguments: { action: "create", project_id: projectId, name: content } };
    case "update_work_item":
      return {
        tool: "workitem",
        arguments: { action: "update", project_id: projectId, work_item_id: workItemId, name: content },
      };
    case "add_comment":
      return {
        tool: "workitem_comment",
        arguments: { action: "create", project_id: projectId, work_item_id: workItemId, comment_html: content },
      };
    default:
      return {};
  }
}

export const MAX_ATTACHMENTS = 5;
const DOCUMENT_EXTENSIONS = new Set([".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".md", ".csv"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a"]);
const MAX_DOCUMENT_MB = 10;
const MAX_AUDIO_MB = 250;
const MB = 1024 * 1024;

/** The file picker's `accept` list: exactly the types `attachmentProblem` lets through. */
export const ATTACHMENT_ACCEPT = [...DOCUMENT_EXTENSIONS, ...AUDIO_EXTENSIONS].join(",");
export const ATTACHMENT_HINT = `Attach up to ${MAX_ATTACHMENTS} files · documents ${MAX_DOCUMENT_MB} MB · ${[
  ...AUDIO_EXTENSIONS,
]
  .map((extension) => extension.slice(1).toUpperCase())
  .join("/")} ${MAX_AUDIO_MB} MB`;

/** Why these files can't be attached, or "" when they can: type, emptiness, size and the per-message cap. */
export function attachmentProblem(files: Array<Pick<File, "name" | "size">>, attached: number, max: number): string {
  if (attached + files.length > max) return `Attach up to ${max} files per message.`;
  for (const file of files) {
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const isAudio = AUDIO_EXTENSIONS.has(extension);
    if ((!isAudio && !DOCUMENT_EXTENSIONS.has(extension)) || file.size <= 0)
      return `${file.name}: unsupported or empty file.`;
    const maxMb = isAudio ? MAX_AUDIO_MB : MAX_DOCUMENT_MB;
    if (file.size > maxMb * MB) return `${file.name}: maximum size is ${maxMb} MB.`;
  }
  return "";
}

/**
 * What the open chat shows. A new, unsaved chat ("") shows nothing even while SWR still holds the
 * previous conversation; files not yet sent with a message wait in the composer.
 */
export function openChat(
  activeConversationId: string,
  conversation?: Pick<ISummonAssistantConversation, "messages" | "actions" | "attachments">
): {
  messages: ISummonAssistantMessage[];
  actions: ISummonAssistantAction[];
  pendingAttachments: ISummonAssistantAttachment[];
} {
  const open = activeConversationId ? conversation : undefined;
  return {
    messages: open?.messages ?? [],
    actions: open?.actions ?? [],
    pendingAttachments: open?.attachments?.filter((attachment) => !attachment.message) ?? [],
  };
}

/** A write the person started from an answer: create a work item or save a page. Lives until reload. */
export interface AssistantWriteback {
  id: string;
  kind: "task" | "page";
  messageId: string;
  created_at: string;
}

export type TAssistantTimelineItem =
  | { type: "message"; at: string; message: ISummonAssistantMessage }
  | { type: "action"; at: string; action: ISummonAssistantAction }
  | { type: "writeback"; at: string; writeback: AssistantWriteback };

/** Messages, proposed actions and write-backs in the order they happened, so each card sits under its cause. */
export function buildTimeline(
  messages: ISummonAssistantMessage[],
  actions: ISummonAssistantAction[],
  writebacks: AssistantWriteback[]
): TAssistantTimelineItem[] {
  const items: TAssistantTimelineItem[] = [
    ...messages.map((message) => ({ type: "message" as const, at: message.created_at, message })),
    ...actions.map((action) => ({ type: "action" as const, at: action.created_at, action })),
    ...writebacks.map((writeback) => ({ type: "writeback" as const, at: writeback.created_at, writeback })),
  ];
  // Stable sort: equal timestamps keep messages before the cards they produced.
  // oxlint-disable-next-line unicorn/no-array-sort -- ES2023 toSorted is unavailable in the app's current TypeScript target.
  return items.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
}

export type TConversationGroup = { label: string; conversations: ISummonAssistantConversation[] };

/** History rail groups, newest first: Today, Previous 7 days, Older. */
export function groupConversations(conversations: ISummonAssistantConversation[], now: Date): TConversationGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
  const groups: TConversationGroup[] = [
    { label: "Today", conversations: [] },
    { label: "Previous 7 days", conversations: [] },
    { label: "Older", conversations: [] },
  ];
  for (const conversation of conversations) {
    const at = Date.parse(conversation.last_activity_at);
    const index = [startOfToday, weekAgo].findIndex((boundary) => at >= boundary);
    groups[index === -1 ? 2 : index].conversations.push(conversation);
  }
  return groups.filter((group) => group.conversations.length > 0);
}

/** Title for a work item or page made from an answer: its first heading or line, without markdown. */
export function titleFromAnswer(markdown: string, fallback: string): string {
  const line = markdown
    .split("\n")
    .map((value) =>
      value
        .replace(/^#+\s*/, "")
        .replace(/[*_`>]/g, "")
        .replace(/^[-\d.]+\s+/, "")
        .trim()
    )
    .find(Boolean);
  const title = line || fallback;
  return title.length > 120 ? `${title.slice(0, 117).trimEnd()}…` : title;
}

export type TAssistantTemplate = {
  id: string;
  label: string;
  description: string;
  scope: Exclude<TAssistantScopeKind, "workspace">;
  prompt: (name: string) => string;
};

/** Summon jobs the assistant does from live data. Each needs one scope, chosen from the card. */
export const ASSISTANT_TEMPLATES: TAssistantTemplate[] = [
  {
    id: "project-digest",
    label: "Project status digest",
    description: "Progress, overdue work and next steps from live work items",
    scope: "project",
    prompt: (name) =>
      `Write a status digest for ${name}: progress by state, overdue or at-risk work items, and the three most important next actions. Cite the work items.`,
  },
  {
    id: "client-update",
    label: "Client progress update",
    description: "A send-ready update across the client's projects",
    scope: "client",
    prompt: (name) =>
      `Draft a progress update I can send to ${name}: what was delivered, what is in progress, open questions and next steps. Keep it plain and non-technical.`,
  },
  {
    id: "meeting-decisions",
    label: "Meeting decisions",
    description: "Decisions, open items and follow-ups from a meeting",
    scope: "meeting",
    prompt: (name) =>
      `Summarise the decisions, open items and owners from ${name}, then list the follow-up tasks I should create.`,
  },
  {
    id: "generate-document",
    label: "Generate a document",
    description: "Proposal, MoM, BAST, UAT and more as PDF and DOCX",
    scope: "project",
    prompt: (name) => `Generate a document for ${name}.`,
  },
];
