/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ISummonMeeting } from "@plane/types";

export const templateVariableNames = (variables: string[]) =>
  variables.filter((variable) => variable !== "title" && variable !== "brief");

const MULTILINE_TEMPLATE_VARIABLES = new Set([
  "items",
  "parties",
  "phases",
  "bugs",
  "test_cases",
  "changes",
  "resources",
  "scope",
  "pricing",
  "rates",
  "workload",
  "scenarios",
  "key_points",
]);

export const isMultilineTemplateVariable = (variable: string) => MULTILINE_TEMPLATE_VARIABLES.has(variable);

export const syncTemplateVariableValues = (variables: string[], current: Record<string, string>) =>
  Object.fromEntries(templateVariableNames(variables).map((variable) => [variable, current[variable] ?? ""]));

export const buildAutomationInput = (
  variables: string[],
  title: string,
  brief: string,
  values: Record<string, string>
) => ({
  title,
  brief,
  ...Object.fromEntries(templateVariableNames(variables).map((variable) => [variable, values[variable] ?? ""])),
});

export const meetingTranscriptReady = (meeting?: Pick<ISummonMeeting, "summary_error" | "transcript_text">) =>
  !meeting ||
  (meeting.summary_error !== "transcribing" &&
    meeting.summary_error !== "transcription_failed" &&
    Boolean(meeting.transcript_text.trim()));

export const automationInputValue = (input: Record<string, unknown>, name: string) => {
  const nested = input.values;
  const values = typeof nested === "object" && nested !== null ? (nested as Record<string, unknown>) : input;
  return typeof values[name] === "string" ? values[name] : "";
};

export const automationJobPath = (workspaceSlug: string, jobId: string) =>
  `/${workspaceSlug}/summon/automation/${jobId}/`;

export const filterAutomationJobs = <
  T extends {
    type: string;
    project: string | null;
    input: Record<string, unknown>;
  },
>(
  jobs: T[],
  projectNames: Map<string, string>,
  query: string,
  type: string
) => {
  const normalized = query.trim().toLowerCase();
  return jobs.filter((job) => {
    if (type !== "all" && job.type !== type) return false;
    return [
      automationInputValue(job.input, "title"),
      job.type.replaceAll("_", " "),
      projectNames.get(job.project ?? ""),
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalized));
  });
};

export const templateVariableLabel = (variable: string) =>
  variable.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
