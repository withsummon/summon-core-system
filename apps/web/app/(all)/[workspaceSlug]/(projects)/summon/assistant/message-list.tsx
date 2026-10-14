/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  CircleDot,
  Copy,
  FilePlus2,
  FileText,
  FolderKanban,
  Link2,
  ListTodo,
  Paperclip,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ISummonAssistantCitation, ISummonAssistantMessage, ISummonAutomationJob } from "@plane/types";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Source, Sources } from "@/components/ai-elements/sources";
import { SummonLogo } from "@/components/summon/brand";
import { summonErrorMessage } from "@/components/summon/screen";
import type { AssistantWriteback, TAssistantTimelineItem } from "./assistant-model";

export function assistantErrorMessage(error: unknown) {
  const code = error && typeof error === "object" && "error_code" in error ? error.error_code : undefined;
  switch (code) {
    case "llm_not_configured":
      return "Ask an instance administrator to configure an LLM, then retry.";
    case "llm_authentication_failed":
      return "Provider authentication failed. Ask an instance administrator to verify the key.";
    case "llm_rate_limited":
      return "The provider rate limit was reached. Wait briefly, then retry.";
    case "llm_timeout":
      return "The provider timed out. Retry with a narrower scope.";
    case "llm_provider_unavailable":
      return "The provider is unavailable. Wait briefly, then retry.";
    case "llm_invalid_response":
      return "The provider returned an invalid response. Retry or ask an administrator to check the model.";
    case "llm_context_too_large":
      return "The selected context is too large. Unpin pages or narrow the scope, then retry.";
    default:
      return summonErrorMessage(error);
  }
}

const CITATION_ICONS: Record<ISummonAssistantCitation["kind"], LucideIcon> = {
  project: FolderKanban,
  issue: CircleDot,
  page: FileText,
  client: Users,
  meeting: CalendarDays,
  resource: Link2,
  attachment: Paperclip,
};

const CITATION_KINDS: Record<ISummonAssistantCitation["kind"], string> = {
  project: "project",
  issue: "work item",
  page: "page",
  client: "client",
  meeting: "meeting",
  resource: "link",
  attachment: "file",
};

/** A failed answer is stored as `<error_code>: <detail>`; show the person what to do instead. */
const failureMessage = (content: string) => assistantErrorMessage({ error_code: content.split(":")[0] });

export function AssistantIdentity() {
  return (
    <span className="inline-flex items-center gap-2 text-12 font-medium text-secondary">
      <span className="grid size-6 place-items-center rounded-md bg-layer-2 text-primary">
        <SummonLogo variant="mark" className="size-3.5" />
      </span>
      Summon
    </span>
  );
}

export function AssistantTimeline(props: {
  items: TAssistantTimelineItem[];
  pending: string;
  canWriteBack: boolean;
  renderAction: (item: Extract<TAssistantTimelineItem, { type: "action" }>) => ReactNode;
  renderWriteback: (writeback: AssistantWriteback) => ReactNode;
  onWriteback: (kind: AssistantWriteback["kind"], message: ISummonAssistantMessage) => void;
  workspaceSlug: string;
}) {
  return (
    <>
      {props.items.map((item) => {
        if (item.type === "action") return <div key={`action-${item.action.id}`}>{props.renderAction(item)}</div>;
        if (item.type === "writeback")
          return <div key={`writeback-${item.writeback.id}`}>{props.renderWriteback(item.writeback)}</div>;
        const { message } = item;
        return message.role === "user" ? (
          <UserMessage key={message.id} message={message} />
        ) : (
          <AnswerMessage
            key={message.id}
            message={message}
            canWriteBack={props.canWriteBack}
            onWriteback={(kind) => props.onWriteback(kind, message)}
            workspaceSlug={props.workspaceSlug}
          />
        );
      })}
      {props.pending ? (
        <>
          <Message from="user">
            <MessageContent from="user">{props.pending}</MessageContent>
          </Message>
          <Message from="assistant" aria-live="polite" aria-busy="true">
            <AssistantIdentity />
            <p className="animate-pulse text-13 text-secondary motion-reduce:animate-none">
              Reading the sources you can access…
            </p>
          </Message>
        </>
      ) : null}
    </>
  );
}

function UserMessage({ message }: { message: ISummonAssistantMessage }) {
  return (
    <Message from="user">
      <MessageContent from="user">{message.content}</MessageContent>
      {message.attachments.length ? (
        <ul className="flex max-w-[85%] flex-wrap justify-end gap-1.5" aria-label="Attached files">
          {message.attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="inline-flex items-center gap-1 rounded-md bg-layer-1 px-2 py-1 text-12 text-secondary"
            >
              <Paperclip aria-hidden className="size-3" />
              <span className="max-w-48 truncate" title={attachment.original_name}>
                {attachment.original_name}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Message>
  );
}

function AnswerMessage(props: {
  message: ISummonAssistantMessage;
  canWriteBack: boolean;
  onWriteback: (kind: AssistantWriteback["kind"]) => void;
  workspaceSlug: string;
}) {
  const { message } = props;
  const [copied, setCopied] = useState(false);
  const failed = message.status === "failed";
  const degraded = message.provider === "deterministic";
  const copyAnswer = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Message from="assistant">
      <AssistantIdentity />
      <MessageContent from="assistant">
        {failed ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-danger-subtle px-3 py-2 text-13 text-danger-primary"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 flex-none" />
            {failureMessage(message.content)}
          </p>
        ) : (
          <>
            {degraded ? (
              <p className="mb-2 text-12 text-warning-primary">
                The language model was unavailable; this answer comes straight from Summon data.
              </p>
            ) : null}
            <MessageResponse markdown={message.content} />
          </>
        )}
      </MessageContent>
      {message.automation_job ? (
        <GeneratedDocument job={message.automation_job} workspaceSlug={props.workspaceSlug} />
      ) : null}
      {message.citations.length ? <AnswerSources citations={message.citations} messageId={message.id} /> : null}
      {failed ? null : (
        <MessageActions>
          <MessageAction
            icon={copied ? Check : Copy}
            label={copied ? "Copied" : "Copy answer"}
            onClick={() => void copyAnswer()}
          />
          {props.canWriteBack ? (
            <>
              <MessageAction
                icon={ListTodo}
                label="Create work item"
                showLabel
                onClick={() => props.onWriteback("task")}
              />
              <MessageAction
                icon={FilePlus2}
                label="Save as page"
                showLabel
                onClick={() => props.onWriteback("page")}
              />
            </>
          ) : null}
          {message.model ? <span className="ml-auto text-11 text-placeholder">{message.model}</span> : null}
        </MessageActions>
      )}
    </Message>
  );
}

function AnswerSources({ citations, messageId }: { citations: ISummonAssistantCitation[]; messageId: string }) {
  const kinds = Array.from(new Set(citations.map((citation) => citation.kind))).slice(0, 3);
  return (
    <Sources
      count={citations.length}
      preview={
        <span className="flex items-center gap-0.5 text-tertiary" aria-hidden>
          {kinds.map((kind) => {
            const Icon = CITATION_ICONS[kind] ?? Building2;
            return <Icon key={kind} className="size-3.5" />;
          })}
        </span>
      }
    >
      {citations.map((citation) => {
        const Icon = CITATION_ICONS[citation.kind] ?? Building2;
        return (
          <Source
            key={`${messageId}-${citation.kind}-${citation.id}`}
            href={citation.href}
            icon={<Icon aria-hidden className="size-3.5" />}
            label={citation.label}
            kind={CITATION_KINDS[citation.kind] ?? citation.kind}
          />
        );
      })}
    </Sources>
  );
}

function GeneratedDocument({ job, workspaceSlug }: { job: ISummonAutomationJob; workspaceSlug: string }) {
  const files = job.artifacts.filter((artifact) => artifact.file_detail);
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-subtle bg-surface-1 px-3 py-2.5 shadow-xs">
      <FileText aria-hidden className="size-4 text-secondary" />
      <span className="mr-auto text-13 font-medium text-primary">Generated document</span>
      <Link
        href={`/${workspaceSlug}/summon/automation/${job.id}/`}
        className="inline-flex items-center gap-1 text-12 font-medium text-accent-primary hover:underline"
      >
        Preview <ArrowUpRight aria-hidden className="size-3.5" />
      </Link>
      {files.map((artifact) => (
        <a
          key={artifact.id}
          href={artifact.file_detail?.href}
          download={artifact.file_detail?.name}
          className="text-12 font-medium text-accent-primary hover:underline"
        >
          Download {artifact.format.toUpperCase()}
        </a>
      ))}
    </div>
  );
}
