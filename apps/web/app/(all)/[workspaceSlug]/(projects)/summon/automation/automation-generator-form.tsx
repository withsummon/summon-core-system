/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@plane/propel/button";
import { MultiSelect, Select } from "@plane/propel/select";
import type { ISummonClient, ISummonMeeting, ISummonPageContext } from "@plane/types";
import { Input, TextArea } from "@plane/ui";
import { cn } from "@plane/utils";
import { SummonField } from "@/components/summon/forms";
import { isMultilineTemplateVariable, templateVariableLabel } from "./automation-form";
import { OUTPUT_FORMAT_LABELS, outputFormats } from "./automation-display";
import type { TAutomationGenerator } from "./use-automation-generator";

const FILE_INPUT_CLASS_NAME =
  "block w-full rounded-lg border border-subtle bg-surface-1 p-2 text-xs text-secondary file:mr-2 file:rounded-md file:border-0 file:bg-layer-2 file:px-2 file:py-1 file:text-primary";

type TAutomationGeneratorFormProps = {
  generator: TAutomationGenerator;
  templateOptions: { value: string; label: string }[];
  projectOptions: { value: string; label: string }[];
  meetings: ISummonMeeting[];
  clients: ISummonClient[];
  pages: ISummonPageContext[];
  meetingId: string;
  onMeetingChange: (meetingId: string) => void;
};

function GeneratorStep(props: { step: number; className?: string; children: ReactNode }) {
  return (
    <div className={cn("relative pl-7", props.className)}>
      <span className="absolute top-0 left-0 grid size-5 place-items-center rounded-full bg-accent-primary text-12 font-semibold text-white">
        {props.step}
      </span>
      {props.children}
    </div>
  );
}

const meetingAudioHint = (uploadingAudio: boolean, meeting?: ISummonMeeting) => {
  if (uploadingAudio) return "Uploading audio…";
  if (meeting?.summary_error === "transcribing") return "Transcribing audio…";
  if (meeting?.summary_error === "transcription_failed") return "Transcription failed. Upload the MP3 or M4A again.";
  if (meeting?.transcript_text) return "Transcript siap digunakan.";
  return "Pick a meeting, then upload an MP3 or M4A · max 250 MB";
};

function ContextDocumentField({ generator }: { generator: TAutomationGenerator }) {
  return (
    <SummonField label="Upload context document (Optional)">
      <input
        type="file"
        accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv"
        disabled={generator.extractingDocument}
        onChange={(event) => void generator.extractDocument(event)}
        className={FILE_INPUT_CLASS_NAME}
      />
      <span className="mt-1 block text-12 text-tertiary">
        {generator.extractingDocument
          ? "Reading document…"
          : generator.documentName || "PDF, DOCX, XLSX, PPTX, TXT, MD, CSV · max 10 MB"}
      </span>
    </SummonField>
  );
}

function MeetingSourceField(props: TAutomationGeneratorFormProps) {
  const { generator, meetingId } = props;
  return (
    <SummonField label="Meeting / audio transcript (Optional)">
      <Select
        value={meetingId}
        onValueChange={(value) => props.onMeetingChange(value)}
        options={[
          { value: "", label: "No meeting source" },
          ...props.meetings.map((meeting) => ({ value: meeting.id, label: meeting.title })),
        ]}
      />
      <input
        type="file"
        accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a"
        disabled={!meetingId || generator.uploadingAudio}
        onChange={(event) => void generator.uploadMeetingAudio(event)}
        className={`mt-2 ${FILE_INPUT_CLASS_NAME}`}
      />
      <span className="mt-1 block text-12 text-tertiary">
        {meetingAudioHint(generator.uploadingAudio, generator.selectedMeeting)}
      </span>
    </SummonField>
  );
}

function TemplateVariableFields({ generator }: { generator: TAutomationGenerator }) {
  return (
    <details className="rounded-xl border border-subtle bg-layer-1/40 p-2.5" open>
      <summary className="cursor-pointer text-12 font-semibold text-primary">Document fields (Optional)</summary>
      <div className="mt-3 grid gap-2.5">
        {generator.templateVariables.map((variable) => (
          <SummonField key={variable} label={templateVariableLabel(variable)}>
            {isMultilineTemplateVariable(variable) ? (
              <TextArea
                value={generator.variableValues[variable] ?? ""}
                onChange={(event) => generator.updateVariable(variable, event.target.value)}
                placeholder="Enter one item per line or structured details"
                className="min-h-16"
              />
            ) : (
              <Input
                value={generator.variableValues[variable] ?? ""}
                onChange={(event) => generator.updateVariable(variable, event.target.value)}
              />
            )}
          </SummonField>
        ))}
      </div>
    </details>
  );
}

function MoreContextFields(props: TAutomationGeneratorFormProps) {
  const { generator } = props;
  return (
    <details className="rounded-xl border border-subtle bg-layer-1/40 p-2.5">
      <summary className="cursor-pointer text-12 font-semibold text-primary">More verified context</summary>
      <div className="mt-3 grid gap-2.5">
        <SummonField label="Client">
          <Select
            value={generator.clientId}
            onValueChange={(value) => generator.setClientId(value)}
            options={[
              { value: "", label: "No client source" },
              ...props.clients.map((client) => ({ value: client.id, label: client.name })),
            ]}
          />
        </SummonField>
        <SummonField label="Documents">
          <MultiSelect
            value={generator.pageIds}
            onValueChange={(values) => generator.setPageIds(values)}
            options={props.pages.map((item) => ({ value: item.page, label: item.page_detail.name }))}
          />
        </SummonField>
        <label className="inline-flex items-center gap-2 text-12 font-medium text-secondary">
          <input
            type="checkbox"
            checked={generator.workspaceContext}
            onChange={(event) => generator.setWorkspaceContext(event.target.checked)}
            className="accent-accent-primary size-4"
          />
          Include workspace name
        </label>
      </div>
    </details>
  );
}

function OutputPreferences({ generator }: { generator: TAutomationGenerator }) {
  return (
    <GeneratorStep step={4}>
      <p className="text-xs font-medium text-secondary">Output Preferences</p>
      <div className="mt-2 flex gap-2">
        {outputFormats(generator.selectedTemplate?.type).map((format) => (
          <span
            key={format}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent-strong bg-accent-subtle/20 text-12 font-semibold text-accent-primary"
          >
            <FileText className="size-3.5" /> {OUTPUT_FORMAT_LABELS[format]}
          </span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <SummonField label="Tone">
          <Select
            value={generator.tone}
            onValueChange={(value) => generator.setTone(value)}
            options={[
              { value: "Professional", label: "Professional" },
              { value: "Concise", label: "Concise" },
              { value: "Formal", label: "Formal" },
            ]}
          />
        </SummonField>
        <SummonField label="Detail Level">
          <Select
            value={generator.detailLevel}
            onValueChange={(value) => generator.setDetailLevel(value)}
            options={[
              { value: "Comprehensive", label: "Comprehensive" },
              { value: "Standard", label: "Standard" },
              { value: "Summary", label: "Summary" },
            ]}
          />
        </SummonField>
      </div>
    </GeneratorStep>
  );
}

export function AutomationGeneratorForm(props: TAutomationGeneratorFormProps) {
  const { generator } = props;
  return (
    <form onSubmit={generator.generatePreview} className="grid gap-4">
      <GeneratorStep step={1}>
        <SummonField label="Select Template">
          <Select
            required
            value={generator.template}
            onValueChange={(value) => generator.selectTemplate(value)}
            options={[{ value: "", label: "Select template" }, ...props.templateOptions]}
          />
        </SummonField>
      </GeneratorStep>
      <GeneratorStep step={2}>
        <SummonField label="Select Project Context">
          <Select
            required
            value={generator.outputProject}
            onValueChange={(value) => generator.setOutputProject(value)}
            options={[{ value: "", label: "Select project" }, ...props.projectOptions]}
          />
        </SummonField>
      </GeneratorStep>
      <GeneratorStep step={3} className="grid gap-2.5">
        <SummonField label="Document Title">
          <Input
            required
            value={generator.title}
            onChange={(event) => generator.setTitle(event.target.value)}
            placeholder="Name this document"
          />
        </SummonField>
        <SummonField label="Additional Context (Optional)">
          <TextArea
            value={generator.brief}
            onChange={(event) => generator.setBrief(event.target.value)}
            placeholder="Add project, scope, or client-specific requirements…"
            className="min-h-20"
          />
        </SummonField>
        <ContextDocumentField generator={generator} />
        <MeetingSourceField {...props} />
        {generator.templateVariables.length ? <TemplateVariableFields generator={generator} /> : null}
        <MoreContextFields {...props} />
      </GeneratorStep>
      <OutputPreferences generator={generator} />
      <Button
        size="xl"
        type="submit"
        disabled={!generator.canGeneratePreview}
        loading={generator.generating}
        className="w-full"
      >
        <Sparkles className="mr-2 size-4" /> Generate Preview
      </Button>
      {generator.formError ? (
        <div className="grid gap-2 rounded-lg bg-danger-subtle p-2.5 text-12 text-danger-primary" role="alert">
          <span>{generator.formError}</span>
          <Button type="button" size="lg" variant="secondary" onClick={() => void generator.generatePreview()}>
            Retry preview
          </Button>
        </div>
      ) : null}
    </form>
  );
}
