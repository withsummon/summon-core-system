/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ISummonAssistantMessageRequest } from "@plane/types";
import type { AssistantComposerState } from "./assistant-composer";

export const MAX_ATTACHMENTS = 5;
const DOCUMENT_EXTENSIONS = new Set([".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".md", ".csv"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a"]);
const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
const AUDIO_MAX_BYTES = 250 * 1024 * 1024;

const extensionOf = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();

/** Returns the first validation error for the selected files, or "" when all are acceptable. */
export const attachmentFilesError = (files: File[]) => {
  for (const file of files) {
    const extension = extensionOf(file.name);
    const isAudio = AUDIO_EXTENSIONS.has(extension);
    if ((!isAudio && !DOCUMENT_EXTENSIONS.has(extension)) || file.size <= 0)
      return `${file.name}: unsupported or empty file.`;
    if (file.size > (isAudio ? AUDIO_MAX_BYTES : DOCUMENT_MAX_BYTES))
      return `${file.name}: maximum size is ${isAudio ? "250 MB" : "10 MB"}.`;
  }
  return "";
};

type TToolPayload = Pick<ISummonAssistantMessageRequest, "tool" | "arguments">;

/** Maps the composer's Plane MCP tool mode to the request's tool payload. */
export const composerToolPayload = (composer: AssistantComposerState, content: string): TToolPayload => {
  const { projectId, workItemId } = composer;
  switch (composer.toolMode) {
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
};

/** Returns the error for a Plane MCP tool mode missing its required selections, or "". */
export const composerToolError = (composer: AssistantComposerState) => {
  if (composer.toolMode !== "chat" && !composer.mcpCredentialId) return "Select an active Plane MCP credential.";
  if (["list_work_items", "create_work_item"].includes(composer.toolMode) && !composer.projectId)
    return "Select a project for this Plane MCP action.";
  if (
    ["update_work_item", "add_comment"].includes(composer.toolMode) &&
    (!composer.projectId || !composer.workItemId.trim())
  )
    return "Select a project and enter the Plane work item ID.";
  return "";
};
