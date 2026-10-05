/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Doc, Id } from "@summon/convex/data-model";
import { Sparkles, Loader2 } from "lucide-react";
import useReloadConfirmations, { usePendingConfirmation, useReloadSubmitting } from "@/hooks/use-reload-confirmation";
import { ContextFields } from "@/components/convex-core/assistant/conversation-form";
import { mutationMessage, selectClass } from "@/components/convex-core/commercial/forms";
import {
  buildAutomationInput,
  templateVariableNames,
  templateVariableLabel,
} from "@/app/(all)/[workspaceSlug]/(projects)/summon/automation/automation-form";
import { TypeIcon } from "./type-icon";
export function AIGeneratorForm({
  template,
  templates,
  address,
  options,
  onTemplateChange,
  onDone,
}: {
  template: Doc<"automationTemplates">;
  templates: Doc<"automationTemplates">[];
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
  options: FunctionReturnType<typeof api.automation.templates.options>;
  onTemplateChange: (template: Doc<"automationTemplates">) => void;
  onDone: (
    jobId: Id<"automationJobs">,
    format: NonNullable<Doc<"automationJobs">["artifacts"]>[number]["format"]
  ) => void;
}) {
  const generate = useAction(api.automation.generate.preview);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [input, setInput] = useState<FunctionArgs<typeof api.automation.generate.preview>["input"]>({});
  const [context, setContext] = useState<FunctionArgs<typeof api.automation.generate.preview>["context"]>({
    projectId: address.project._id,
    clientId: null,
    meetingId: null,
    documentIds: [],
  });
  const [preferences, setPreferences] = useState<
    NonNullable<FunctionArgs<typeof api.automation.generate.preview>["preferences"]>
  >({ tone: "Professional", detailLevel: "Comprehensive" });
  const [format, setFormat] = useState<(typeof options.formats)[number]>("pdf");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const submitting = useReloadSubmitting();
  const beginPending = usePendingConfirmation("Document generation is still running.");
  const dirty = Boolean(
    title ||
    brief ||
    Object.values(input).some(Boolean) ||
    context.clientId ||
    context.meetingId ||
    context.documentIds.length ||
    preferences.tone !== "Professional" ||
    preferences.detailLevel !== "Comprehensive"
  );
  const release = useReloadConfirmations(dirty, "This document request has unsaved changes.", undefined, pending);
  const request = useRef<{ signature: string; requestId: string } | null>(null);
  const canWrite = address.projectRole !== "guest" && address.workspaceRole !== "guest";
  return (
    <form
      className="shadow-xs flex flex-col rounded-xl border border-subtle bg-surface-1 p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending || submitting || !canWrite) return;
        const args = {
          templateId: template._id,
          expectedTemplateRevision: template.revision,
          projectId: address.project._id,
          title,
          input: buildAutomationInput(template.variables, title, brief, input),
          context,
          preferences,
        };
        const signature = JSON.stringify(args);
        if (request.current?.signature !== signature) request.current = { signature, requestId: crypto.randomUUID() };
        const finish = beginPending();
        setPending(true);
        setError("");
        try {
          const jobId = await generate({ ...args, requestId: request.current.requestId });
          release(() => {
            setTitle("");
            setBrief("");
            setInput({});
            setContext({ projectId: address.project._id, clientId: null, meetingId: null, documentIds: [] });
            setPreferences({ tone: "Professional", detailLevel: "Comprehensive" });
            request.current = null;
            onDone(jobId, format);
          });
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
          finish();
        }
      }}
    >
      <div className="mb-5">
        <h2 className="text-base font-semibold text-primary">AI Document Generator</h2>
        <p className="text-xs mt-0.5 text-secondary">Generate a private preview before publication</p>
      </div>
      <fieldset disabled={pending || submitting || !canWrite} className="space-y-4">
        <div>
          <label className="text-xs mb-1.5 block font-semibold text-primary" htmlFor="automation-template">
            1. Select Template
          </label>
          <div className="flex items-center gap-2">
            <TypeIcon type={template.type} size={15} />
            <select
              id="automation-template"
              className={`${selectClass} min-w-0 flex-1`}
              value={template._id}
              onChange={(event) => {
                const selected = templates.find((row) => row._id === event.target.value);
                if (selected) onTemplateChange(selected);
              }}
            >
              {!templates.some((row) => row._id === template._id) && (
                <option value={template._id}>{template.name}</option>
              )}
              {templates.map((row) => (
                <option key={row._id} value={row._id} disabled={!row.isActive}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-[11px] text-secondary">{template.description}</p>
        </div>
        <div>
          <label className="text-xs mb-1.5 block font-semibold text-primary" htmlFor="automation-title">
            2. Document title
          </label>
          <input
            id="automation-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={255}
            className={`${selectClass} w-full`}
          />
          <p className="mt-1 text-[11px] text-secondary">Destination: {address.project.name}</p>
        </div>
        <div>
          <label className="text-xs mb-1.5 block font-semibold text-primary" htmlFor="automation-brief">
            3. Additional Context
          </label>
          <textarea
            id="automation-brief"
            rows={3}
            maxLength={1000}
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            className={`${selectClass} w-full resize-none`}
            placeholder="Add scope, requirements, or instructions…"
          />
          <p className="mt-1 text-right text-[10px] text-placeholder">{brief.length}/1000</p>
        </div>
        {templateVariableNames(template.variables).map((variable) => (
          <label key={variable} className="text-xs block font-medium text-primary">
            {templateVariableLabel(variable)}
            <textarea
              rows={2}
              value={input[variable] ?? ""}
              onChange={(event) => setInput({ ...input, [variable]: event.target.value })}
              className={`${selectClass} mt-1 w-full`}
            />
          </label>
        ))}
        <details>
          <summary className="text-xs cursor-pointer font-semibold">Context sources</summary>
          <div className="mt-3">
            <ContextFields
              workspaceId={address.workspace._id}
              value={context}
              onChange={setContext}
              showProject={false}
            />
          </div>
        </details>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-primary">4. Output Preferences</p>
          <label className="block text-[11px] text-secondary">
            Download preference
            <select
              className={`${selectClass} mt-1 w-full`}
              value={format}
              onChange={(event) => {
                const selected = options.formats.find((value) => value === event.target.value);
                if (selected) setFormat(selected);
              }}
            >
              {options.formats.map((value) => (
                <option key={value} value={value}>
                  {value.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-secondary">Available file types are shown after rendering.</p>
          <label className="block text-[11px] text-secondary">
            Tone
            <select
              className={`${selectClass} mt-1 w-full`}
              value={preferences.tone}
              onChange={(event) => {
                const selected = options.tones.find((value) => value === event.target.value);
                if (selected) setPreferences({ ...preferences, tone: selected });
              }}
            >
              {options.tones.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] text-secondary">
            Detail Level
            <select
              className={`${selectClass} mt-1 w-full`}
              value={preferences.detailLevel}
              onChange={(event) => {
                const selected = options.detailLevels.find((value) => value === event.target.value);
                if (selected) setPreferences({ ...preferences, detailLevel: selected });
              }}
            >
              {options.detailLevels.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={!template.isActive}
          className="bg-blue-600 text-xs flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{" "}
          {pending ? "Generating Document…" : "Generate Document"}
        </button>
      </fieldset>
      {!canWrite && <p className="text-xs mt-3 text-secondary">Project write access is required to generate.</p>}
      {error && (
        <p role="alert" className="text-xs mt-3 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
