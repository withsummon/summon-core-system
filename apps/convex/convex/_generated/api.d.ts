/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assets_access from "../assets/access.js";
import type * as assets_cleanup from "../assets/cleanup.js";
import type * as assets_content from "../assets/content.js";
import type * as assets_http from "../assets/http.js";
import type * as assets_index from "../assets/index.js";
import type * as assets_upload from "../assets/upload.js";
import type * as assistant_access from "../assistant/access.js";
import type * as assistant_actions from "../assistant/actions.js";
import type * as assistant_attachment_upload from "../assistant/attachment_upload.js";
import type * as assistant_attachments from "../assistant/attachments.js";
import type * as assistant_context from "../assistant/context.js";
import type * as assistant_http from "../assistant/http.js";
import type * as assistant_index from "../assistant/index.js";
import type * as assistant_messages from "../assistant/messages.js";
import type * as assistant_provider from "../assistant/provider.js";
import type * as auth from "../auth.js";
import type * as automation_access from "../automation/access.js";
import type * as automation_defaults from "../automation/defaults.js";
import type * as automation_generate from "../automation/generate.js";
import type * as automation_jobs from "../automation/jobs.js";
import type * as automation_publication from "../automation/publication.js";
import type * as automation_publish from "../automation/publish.js";
import type * as automation_templates from "../automation/templates.js";
import type * as commercial_clients from "../commercial/clients.js";
import type * as commercial_contacts from "../commercial/contacts.js";
import type * as commercial_delivery from "../commercial/delivery.js";
import type * as commercial_directory from "../commercial/directory.js";
import type * as commercial_opportunities from "../commercial/opportunities.js";
import type * as commercial_validation from "../commercial/validation.js";
import type * as crons from "../crons.js";
import type * as cycles_access from "../cycles/access.js";
import type * as cycles_dates from "../cycles/dates.js";
import type * as cycles_index from "../cycles/index.js";
import type * as cycles_tasks from "../cycles/tasks.js";
import type * as documents_access from "../documents/access.js";
import type * as documents_index from "../documents/index.js";
import type * as documents_lifecycle from "../documents/lifecycle.js";
import type * as http from "../http.js";
import type * as identity_access from "../identity/access.js";
import type * as identity_index from "../identity/index.js";
import type * as lib_documentConversion from "../lib/documentConversion.js";
import type * as mcp_access from "../mcp/access.js";
import type * as mcp_client from "../mcp/client.js";
import type * as mcp_credentials from "../mcp/credentials.js";
import type * as mcp_crypto from "../mcp/crypto.js";
import type * as mcp_invocations from "../mcp/invocations.js";
import type * as mcp_sensitive from "../mcp/sensitive.js";
import type * as mcp_sensitiveAccess from "../mcp/sensitiveAccess.js";
import type * as mcp_stepUp from "../mcp/stepUp.js";
import type * as mcp_tools from "../mcp/tools.js";
import type * as mcp_transport from "../mcp/transport.js";
import type * as mcp_vault from "../mcp/vault.js";
import type * as meetings_access from "../meetings/access.js";
import type * as meetings_index from "../meetings/index.js";
import type * as meetings_summary_access from "../meetings/summary/access.js";
import type * as meetings_summary_document from "../meetings/summary/document.js";
import type * as meetings_summary_generate from "../meetings/summary/generate.js";
import type * as meetings_summary_mom from "../meetings/summary/mom.js";
import type * as meetings_summary_runs from "../meetings/summary/runs.js";
import type * as meetings_summary_title from "../meetings/summary/title.js";
import type * as meetings_summary_transcriptActions from "../meetings/summary/transcriptActions.js";
import type * as meetings_summary_transcripts from "../meetings/summary/transcripts.js";
import type * as meetings_summary_validation from "../meetings/summary/validation.js";
import type * as meetings_tasks from "../meetings/tasks.js";
import type * as notifications_delivery from "../notifications/delivery.js";
import type * as notifications_index from "../notifications/index.js";
import type * as projects_create from "../projects/create.js";
import type * as projects_index from "../projects/index.js";
import type * as projects_timezone from "../projects/timezone.js";
import type * as reporting_commercial from "../reporting/commercial.js";
import type * as reporting_documents from "../reporting/documents.js";
import type * as reporting_meetings from "../reporting/meetings.js";
import type * as reporting_overview from "../reporting/overview.js";
import type * as reporting_projects from "../reporting/projects.js";
import type * as reporting_scope from "../reporting/scope.js";
import type * as reporting_tasks from "../reporting/tasks.js";
import type * as resources_index from "../resources/index.js";
import type * as settings_index from "../settings/index.js";
import type * as settings_timezone from "../settings/timezone.js";
import type * as tasks_assignees from "../tasks/assignees.js";
import type * as tasks_center from "../tasks/center.js";
import type * as tasks_comments from "../tasks/comments.js";
import type * as tasks_description from "../tasks/description.js";
import type * as tasks_hierarchy from "../tasks/hierarchy.js";
import type * as tasks_index from "../tasks/index.js";
import type * as tasks_labels from "../tasks/labels.js";
import type * as tasks_properties from "../tasks/properties.js";
import type * as tasks_relationships from "../tasks/relationships.js";
import type * as tasks_revision from "../tasks/revision.js";
import type * as tasks_rich_content from "../tasks/rich_content.js";
import type * as tasks_states from "../tasks/states.js";
import type * as tasks_status from "../tasks/status.js";
import type * as workspaces_index from "../workspaces/index.js";

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

declare const fullApi: ApiFromModules<{
  "assets/access": typeof assets_access;
  "assets/cleanup": typeof assets_cleanup;
  "assets/content": typeof assets_content;
  "assets/http": typeof assets_http;
  "assets/index": typeof assets_index;
  "assets/upload": typeof assets_upload;
  "assistant/access": typeof assistant_access;
  "assistant/actions": typeof assistant_actions;
  "assistant/attachment_upload": typeof assistant_attachment_upload;
  "assistant/attachments": typeof assistant_attachments;
  "assistant/context": typeof assistant_context;
  "assistant/http": typeof assistant_http;
  "assistant/index": typeof assistant_index;
  "assistant/messages": typeof assistant_messages;
  "assistant/provider": typeof assistant_provider;
  auth: typeof auth;
  "automation/access": typeof automation_access;
  "automation/defaults": typeof automation_defaults;
  "automation/generate": typeof automation_generate;
  "automation/jobs": typeof automation_jobs;
  "automation/publication": typeof automation_publication;
  "automation/publish": typeof automation_publish;
  "automation/templates": typeof automation_templates;
  "commercial/clients": typeof commercial_clients;
  "commercial/contacts": typeof commercial_contacts;
  "commercial/delivery": typeof commercial_delivery;
  "commercial/directory": typeof commercial_directory;
  "commercial/opportunities": typeof commercial_opportunities;
  "commercial/validation": typeof commercial_validation;
  crons: typeof crons;
  "cycles/access": typeof cycles_access;
  "cycles/dates": typeof cycles_dates;
  "cycles/index": typeof cycles_index;
  "cycles/tasks": typeof cycles_tasks;
  "documents/access": typeof documents_access;
  "documents/index": typeof documents_index;
  "documents/lifecycle": typeof documents_lifecycle;
  http: typeof http;
  "identity/access": typeof identity_access;
  "identity/index": typeof identity_index;
  "lib/documentConversion": typeof lib_documentConversion;
  "mcp/access": typeof mcp_access;
  "mcp/client": typeof mcp_client;
  "mcp/credentials": typeof mcp_credentials;
  "mcp/crypto": typeof mcp_crypto;
  "mcp/invocations": typeof mcp_invocations;
  "mcp/sensitive": typeof mcp_sensitive;
  "mcp/sensitiveAccess": typeof mcp_sensitiveAccess;
  "mcp/stepUp": typeof mcp_stepUp;
  "mcp/tools": typeof mcp_tools;
  "mcp/transport": typeof mcp_transport;
  "mcp/vault": typeof mcp_vault;
  "meetings/access": typeof meetings_access;
  "meetings/index": typeof meetings_index;
  "meetings/summary/access": typeof meetings_summary_access;
  "meetings/summary/document": typeof meetings_summary_document;
  "meetings/summary/generate": typeof meetings_summary_generate;
  "meetings/summary/mom": typeof meetings_summary_mom;
  "meetings/summary/runs": typeof meetings_summary_runs;
  "meetings/summary/title": typeof meetings_summary_title;
  "meetings/summary/transcriptActions": typeof meetings_summary_transcriptActions;
  "meetings/summary/transcripts": typeof meetings_summary_transcripts;
  "meetings/summary/validation": typeof meetings_summary_validation;
  "meetings/tasks": typeof meetings_tasks;
  "notifications/delivery": typeof notifications_delivery;
  "notifications/index": typeof notifications_index;
  "projects/create": typeof projects_create;
  "projects/index": typeof projects_index;
  "projects/timezone": typeof projects_timezone;
  "reporting/commercial": typeof reporting_commercial;
  "reporting/documents": typeof reporting_documents;
  "reporting/meetings": typeof reporting_meetings;
  "reporting/overview": typeof reporting_overview;
  "reporting/projects": typeof reporting_projects;
  "reporting/scope": typeof reporting_scope;
  "reporting/tasks": typeof reporting_tasks;
  "resources/index": typeof resources_index;
  "settings/index": typeof settings_index;
  "settings/timezone": typeof settings_timezone;
  "tasks/assignees": typeof tasks_assignees;
  "tasks/center": typeof tasks_center;
  "tasks/comments": typeof tasks_comments;
  "tasks/description": typeof tasks_description;
  "tasks/hierarchy": typeof tasks_hierarchy;
  "tasks/index": typeof tasks_index;
  "tasks/labels": typeof tasks_labels;
  "tasks/properties": typeof tasks_properties;
  "tasks/relationships": typeof tasks_relationships;
  "tasks/revision": typeof tasks_revision;
  "tasks/rich_content": typeof tasks_rich_content;
  "tasks/states": typeof tasks_states;
  "tasks/status": typeof tasks_status;
  "workspaces/index": typeof workspaces_index;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;

export declare const components: {};
