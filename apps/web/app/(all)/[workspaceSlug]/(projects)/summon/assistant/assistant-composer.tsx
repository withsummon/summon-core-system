/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FormEventHandler, ReactNode, Ref } from "react";
import {
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  FileAudio,
  FileText,
  FolderKanban,
  LoaderCircle,
  Paperclip,
  Plug,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, getButtonStyling } from "@plane/propel/button";
import { IconButton } from "@plane/propel/icon-button";
import { Input } from "@plane/propel/input";
import { MENU_ITEM_CLASSNAME, MenuPrimitive as Menu } from "@plane/propel/menu";
import { Tooltip } from "@plane/propel/tooltip";
import type {
  ISummonAssistantAttachment,
  ISummonClient,
  ISummonCredential,
  ISummonMeeting,
  ISummonPageContext,
} from "@plane/types";
import { cn } from "@plane/utils";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { OPTION_POPUP_CLASSNAME, OptionItem, OptionSubmenu } from "@/components/summon/option-menu";
import type { TOption } from "@/components/summon/option-menu";
import { shouldSubmitAssistantComposer } from "./composer-keyboard.js";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_HINT,
  MAX_ATTACHMENTS,
  TOOL_LABELS,
  WORKSPACE_SCOPE,
  toolNeedsWorkItem,
} from "./assistant-model";
import type {
  AssistantComposerState,
  TAssistantScope,
  TAssistantScopeKind,
  TAssistantToolMode,
} from "./assistant-model";

export const SCOPE_ICONS: Record<TAssistantScopeKind, LucideIcon> = {
  workspace: Building2,
  project: FolderKanban,
  client: Users,
  meeting: CalendarDays,
};

const CHIP_CLASSNAME = cn(getButtonStyling("ghost", "sm"), "max-w-full min-w-0 text-secondary");

export type TScopeOptions = Record<Exclude<TAssistantScopeKind, "workspace">, TOption[]>;

/** The chip text for a scope; a record whose options haven't arrived yet reads as loading. */
export const scopeLabelFor = (scope: TAssistantScope, options: TScopeOptions) =>
  scope.kind === "workspace"
    ? "Whole workspace"
    : (options[scope.kind].find((option) => option.id === scope.id)?.label ?? "Loading…");

interface AssistantComposerProps {
  value: AssistantComposerState;
  scopeOptions: TScopeOptions;
  scopeLabel: string;
  pages: ISummonPageContext[];
  credentials: ISummonCredential[];
  attachments: ISummonAssistantAttachment[];
  uploadingFiles: File[];
  removingAttachment: string;
  sending: boolean;
  placeholder: string;
  textareaRef?: Ref<HTMLTextAreaElement>;
  onChange: (patch: Partial<AssistantComposerState>) => void;
  onScopeChange: (scope: TAssistantScope) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onFiles: (files: File[]) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  footer?: ReactNode;
}

export function scopeOptionsFrom(
  projects: TOption[],
  clients: ISummonClient[] = [],
  meetings: ISummonMeeting[] = []
): TScopeOptions {
  return {
    project: projects,
    client: clients.map((client) => ({ id: client.id, label: client.name })),
    meeting: meetings.map((meeting) => ({ id: meeting.id, label: meeting.title })),
  };
}

export function AssistantComposer(props: AssistantComposerProps) {
  const { value } = props;
  const attachmentCount = props.attachments.length + props.uploadingFiles.length;
  const toolMode = value.toolMode;

  return (
    <div className="w-full space-y-2">
      <PromptInput onSubmit={props.onSubmit} onFiles={props.onFiles}>
        {attachmentCount || toolMode !== "chat" ? (
          <PromptInputHeader aria-label="Message context">
            {toolMode !== "chat" ? (
              <ToolChip
                mode={toolMode}
                workItemId={value.workItemId}
                onWorkItemId={(workItemId) => props.onChange({ workItemId })}
                onClear={() => props.onChange({ toolMode: "chat", workItemId: "" })}
              />
            ) : null}
            {props.attachments.map((attachment) => (
              <AttachmentChip
                key={attachment.id}
                attachment={attachment}
                removing={props.removingAttachment === attachment.id}
                onRemove={() => props.onRemoveAttachment(attachment.id)}
              />
            ))}
            {props.uploadingFiles.map((file) => (
              <span
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-layer-1 px-2 text-12 text-secondary"
              >
                <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
                <span className="max-w-40 truncate" title={file.name}>
                  {file.name}
                </span>
                <span className="text-tertiary">uploading</span>
              </span>
            ))}
          </PromptInputHeader>
        ) : null}
        <PromptInputTextarea
          ref={props.textareaRef}
          aria-label="Message Summon Assistant"
          value={value.content}
          placeholder={props.placeholder}
          onChange={(event) => props.onChange({ content: event.target.value })}
          onKeyDown={(event) => {
            const submit = shouldSubmitAssistantComposer({
              key: event.key,
              shiftKey: event.shiftKey,
              isComposing: event.nativeEvent.isComposing,
            });
            if (!submit) return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
        />
        <PromptInputFooter>
          <PromptInputTools>
            <Tooltip tooltipContent={ATTACHMENT_HINT}>
              <label
                className={cn(
                  "grid size-7 flex-none cursor-pointer place-items-center rounded-md text-secondary focus-within:outline-2 focus-within:outline-accent-strong focus-within:outline-solid hover:bg-layer-transparent-hover hover:text-primary",
                  attachmentCount >= MAX_ATTACHMENTS && "pointer-events-none opacity-50"
                )}
              >
                <Paperclip aria-hidden className="size-4" />
                <span className="sr-only">Attach files</span>
                <input
                  type="file"
                  multiple
                  accept={ATTACHMENT_ACCEPT}
                  disabled={attachmentCount >= MAX_ATTACHMENTS}
                  onChange={(event) => {
                    props.onFiles(Array.from(event.target.files ?? []));
                    event.target.value = "";
                  }}
                  className="sr-only"
                />
              </label>
            </Tooltip>
            <ScopeMenu
              value={value}
              label={props.scopeLabel}
              options={props.scopeOptions}
              pages={props.pages}
              onScopeChange={props.onScopeChange}
              onChange={props.onChange}
            />
            {props.credentials.length ? (
              <ToolsMenu
                mode={toolMode}
                credentialId={value.mcpCredentialId}
                credentials={props.credentials}
                onChange={props.onChange}
              />
            ) : null}
          </PromptInputTools>
          <PromptInputSubmit loading={props.sending} disabled={!value.content.trim()} />
        </PromptInputFooter>
      </PromptInput>
      {props.footer}
    </div>
  );
}

function ScopeMenu(props: {
  value: AssistantComposerState;
  label: string;
  options: TScopeOptions;
  pages: ISummonPageContext[];
  onScopeChange: (scope: TAssistantScope) => void;
  onChange: (patch: Partial<AssistantComposerState>) => void;
}) {
  const { scope, pageIds } = props.value;
  const ScopeIcon = SCOPE_ICONS[scope.kind];
  const selectedPages = new Set(pageIds);
  const groups: Array<{ kind: Exclude<TAssistantScopeKind, "workspace">; label: string }> = [
    { kind: "project", label: "Project" },
    { kind: "client", label: "Client" },
    { kind: "meeting", label: "Meeting" },
  ];

  return (
    <Menu.Root>
      <Menu.Trigger className={CHIP_CLASSNAME} aria-label={`Scope: ${props.label}. Change scope`}>
        <ScopeIcon aria-hidden className="size-3.5" />
        <span className="max-w-48 truncate">{props.label}</span>
        {pageIds.length ? (
          <span className="rounded-sm bg-layer-2 px-1 text-11 text-tertiary tabular-nums">+{pageIds.length}</span>
        ) : null}
        <ChevronDown aria-hidden className="size-3" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="start" sideOffset={6} className="z-[120]">
          <Menu.Popup className={OPTION_POPUP_CLASSNAME}>
            <OptionItem
              label="Whole workspace"
              icon={<Building2 aria-hidden className="size-4 text-secondary" />}
              selected={scope.kind === "workspace"}
              onClick={() => props.onScopeChange(WORKSPACE_SCOPE)}
            />
            {groups.map(({ kind, label }) => (
              <OptionSubmenu
                key={kind}
                icon={SCOPE_ICONS[kind]}
                label={label}
                options={props.options[kind]}
                trailing={scope.kind === kind ? <Check aria-hidden className="size-4 text-accent-primary" /> : null}
                isChecked={(id) => scope.kind === kind && id === scope.id}
                onPick={(id) => props.onScopeChange({ kind, id })}
              />
            ))}
            <Menu.Separator className="my-1 h-px bg-(--border-color-subtle)" />
            <OptionSubmenu
              icon={FileText}
              label="Pin pages"
              options={props.pages.map((page) => ({ id: page.page, label: page.page_detail.name || "Untitled page" }))}
              trailing={
                pageIds.length ? <span className="text-12 text-tertiary tabular-nums">{pageIds.length}</span> : null
              }
              isChecked={(id) => selectedPages.has(id)}
              onPick={(id) =>
                props.onChange({
                  pageIds: selectedPages.has(id) ? pageIds.filter((item) => item !== id) : [...pageIds, id],
                })
              }
              multiple
            />
            <Menu.CheckboxItem
              className={MENU_ITEM_CLASSNAME}
              checked={props.value.workspaceSummary}
              onCheckedChange={(checked) => props.onChange({ workspaceSummary: checked })}
            >
              <Building2 aria-hidden className="size-4 text-secondary" />
              <span className="flex-1">Add workspace summary</span>
              <Menu.CheckboxItemIndicator className="text-accent-primary">
                <Check aria-hidden className="size-4" />
              </Menu.CheckboxItemIndicator>
            </Menu.CheckboxItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ToolsMenu(props: {
  mode: TAssistantToolMode;
  credentialId: string;
  credentials: ISummonCredential[];
  onChange: (patch: Partial<AssistantComposerState>) => void;
}) {
  const modes = Object.entries(TOOL_LABELS) as Array<[Exclude<TAssistantToolMode, "chat">, string]>;
  const credentialId = props.credentialId || props.credentials[0]?.id || "";
  return (
    <Menu.Root>
      <Menu.Trigger className={CHIP_CLASSNAME} aria-label="Plane MCP tools">
        <Plug aria-hidden className="size-3.5" />
        <span className="hidden sm:inline">Tools</span>
        <ChevronDown aria-hidden className="size-3" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="start" sideOffset={6} className="z-[120]">
          <Menu.Popup className={OPTION_POPUP_CLASSNAME}>
            <Menu.Group>
              <Menu.GroupLabel className="px-2 pt-1 pb-1.5 text-11 font-medium text-tertiary">
                Plane MCP · writes ask before running
              </Menu.GroupLabel>
              {modes.map(([mode, label]) => (
                <OptionItem
                  key={mode}
                  label={label}
                  selected={props.mode === mode}
                  onClick={() => props.onChange({ toolMode: mode, mcpCredentialId: credentialId })}
                />
              ))}
            </Menu.Group>
            {props.credentials.length > 1 ? (
              <>
                <Menu.Separator className="my-1 h-px bg-(--border-color-subtle)" />
                <Menu.Group>
                  <Menu.GroupLabel className="px-2 pt-1 pb-1.5 text-11 font-medium text-tertiary">
                    Credential
                  </Menu.GroupLabel>
                  {props.credentials.map((credential) => (
                    <OptionItem
                      key={credential.id}
                      label={credential.name}
                      selected={credential.id === credentialId}
                      onClick={() => props.onChange({ mcpCredentialId: credential.id })}
                    />
                  ))}
                </Menu.Group>
              </>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ToolChip(props: {
  mode: Exclude<TAssistantToolMode, "chat">;
  workItemId: string;
  onWorkItemId: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-1.5 rounded-lg bg-accent-subtle py-0.5 pr-0.5 pl-2 text-12 font-medium text-accent-primary">
      <Plug aria-hidden className="size-3.5" />
      <span>{TOOL_LABELS[props.mode]}</span>
      {toolNeedsWorkItem(props.mode) ? (
        <Input
          aria-label="Work item ID"
          placeholder="Work item ID"
          value={props.workItemId}
          onChange={(event) => props.onWorkItemId(event.target.value)}
          className="h-6 w-36 px-2 text-12"
        />
      ) : null}
      <IconButton variant="ghost" size="sm" icon={X} aria-label="Stop using this tool" onClick={props.onClear} />
    </div>
  );
}

function AttachmentChip(props: { attachment: ISummonAssistantAttachment; removing: boolean; onRemove: () => void }) {
  const { attachment } = props;
  const Icon = attachment.media_type.startsWith("audio/") ? FileAudio : FileText;
  const status = attachment.status === "processing" ? "transcribing" : attachment.status;
  return (
    <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg bg-layer-1 pr-0.5 pl-2 text-12 text-secondary">
      <Icon aria-hidden className="size-3.5 flex-none" />
      <span className="max-w-40 truncate text-primary" title={attachment.original_name}>
        {attachment.original_name}
      </span>
      {status !== "ready" ? (
        <span className={attachment.status === "failed" ? "text-danger-primary" : "text-tertiary"}>{status}</span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Remove ${attachment.original_name}`}
        loading={props.removing}
        onClick={props.onRemove}
        className="h-6 w-6 px-0"
      >
        <X aria-hidden className="size-3" />
      </Button>
    </span>
  );
}
