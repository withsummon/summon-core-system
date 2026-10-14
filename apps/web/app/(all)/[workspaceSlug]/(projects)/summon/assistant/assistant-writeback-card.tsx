/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUpRight, FilePlus2, ListTodo } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { Select } from "@plane/propel/select";
import { EPageAccess } from "@plane/constants";
import { Tool, ToolContent, ToolFooter, ToolHeader } from "@/components/ai-elements/tool";
import { SummonField } from "@/components/summon/forms";
import { summonErrorMessage } from "@/components/summon/screen";
import { StatusBadge } from "@/components/summon/status-badge";
import { IssueService } from "@/services/issue";
import { ProjectPageService } from "@/services/page";
import type { AssistantWriteback } from "./assistant-model";

const issueService = new IssueService();
const pageService = new ProjectPageService();

export type TWritebackProject = { id: string; label: string; identifier: string };

const COPY = {
  task: { title: "Create a work item", icon: ListTodo, confirm: "Create work item", done: "Open work item" },
  page: { title: "Save as a Knowledge page", icon: FilePlus2, confirm: "Save page", done: "Open page" },
} as const;

/** Plane stores rich text as HTML; the answer is Markdown. */
const markdownToHtml = (markdown: string) =>
  renderToStaticMarkup(<ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>);

/**
 * Turns an answer into a Plane work item or project page, only after the person checks the title and
 * project and confirms. Uses the same Plane endpoints and permissions as the rest of the app.
 */
export function AssistantWritebackCard(props: {
  writeback: AssistantWriteback;
  markdown: string;
  defaultTitle: string;
  defaultProjectId: string;
  projects: TWritebackProject[];
  workspaceSlug: string;
  onDismiss: () => void;
}) {
  const copy = COPY[props.writeback.kind];
  const [title, setTitle] = useState(props.defaultTitle);
  const [projectId, setProjectId] = useState(props.defaultProjectId || props.projects[0]?.id || "");
  const [status, setStatus] = useState<"pending" | "confirmed" | "completed" | "failed">("pending");
  const [error, setError] = useState("");
  const [href, setHref] = useState("");

  const confirm = async () => {
    const project = props.projects.find((item) => item.id === projectId);
    if (!project || !title.trim()) return setError("Choose a project and enter a title.");
    setStatus("confirmed");
    setError("");
    try {
      const descriptionHtml = markdownToHtml(props.markdown);
      if (props.writeback.kind === "task") {
        const issue = await issueService.createIssue(props.workspaceSlug, project.id, {
          name: title.trim(),
          description_html: descriptionHtml,
        });
        setHref(`/${props.workspaceSlug}/browse/${project.identifier}-${issue.sequence_id}/`);
      } else {
        const page = await pageService.create(props.workspaceSlug, project.id, {
          name: title.trim(),
          description_html: descriptionHtml,
          access: EPageAccess.PUBLIC,
        });
        setHref(`/${props.workspaceSlug}/projects/${project.id}/pages/${page.id}/`);
      }
      setStatus("completed");
    } catch (failure) {
      setError(summonErrorMessage(failure));
      setStatus("failed");
    }
  };

  const editable = status === "pending" || status === "failed";
  return (
    <Tool aria-label={copy.title}>
      <ToolHeader
        icon={copy.icon}
        title={copy.title}
        description={
          props.writeback.kind === "page"
            ? "Project members can read it in Knowledge."
            : "The answer becomes the work item description."
        }
        status={
          status === "pending" ? null : (
            <StatusBadge status={status} label={{ confirmed: "Saving", completed: "Done", failed: "Failed" }[status]} />
          )
        }
      />
      {editable ? (
        <ToolContent className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <SummonField label="Title">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} className="h-8 w-full" />
          </SummonField>
          <SummonField label="Project">
            <Select
              value={projectId}
              onValueChange={setProjectId}
              placeholder="Choose a project"
              options={props.projects.map((project) => ({ value: project.id, label: project.label }))}
            />
          </SummonField>
        </ToolContent>
      ) : (
        <ToolContent>
          <p className="truncate text-13 font-medium text-primary">{title}</p>
        </ToolContent>
      )}
      {error ? (
        <ToolContent>
          <p role="alert" className="text-12 text-danger-primary">
            {error}
          </p>
        </ToolContent>
      ) : null}
      <ToolFooter>
        {status === "completed" ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-12 font-medium text-accent-primary hover:underline"
          >
            {copy.done} <ArrowUpRight aria-hidden className="size-3.5" />
          </Link>
        ) : (
          <>
            <Button
              size="sm"
              loading={status === "confirmed"}
              disabled={!projectId || !title.trim()}
              onClick={() => void confirm()}
            >
              {copy.confirm}
            </Button>
            <Button size="sm" variant="ghost" disabled={status === "confirmed"} onClick={props.onDismiss}>
              Cancel
            </Button>
          </>
        )}
      </ToolFooter>
    </Tool>
  );
}
