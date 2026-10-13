/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { EFileAssetType } from "@plane/types";
import type { ISummonAutomationTemplate, ISummonMeeting } from "@plane/types";
import { summonLLMErrorMessage } from "@/components/summon/screen";
import { FileService } from "@/services/file.service";
import { summonService } from "@/services/summon.service";
import {
  automationJobPath,
  buildAutomationInput,
  meetingTranscriptReady,
  syncTemplateVariableValues,
  templateVariableNames,
} from "./automation-form";

const fileService = new FileService();

type TAutomationGeneratorOptions = {
  workspaceSlug: string;
  templates: ISummonAutomationTemplate[];
  meetings: ISummonMeeting[] | undefined;
  meetingId: string;
  refresh: () => Promise<unknown>;
};

export type TAutomationGenerator = ReturnType<typeof useAutomationGenerator>;

export function useAutomationGenerator({
  workspaceSlug,
  templates,
  meetings,
  meetingId,
  refresh,
}: TAutomationGeneratorOptions) {
  const router = useRouter();
  const [template, setTemplate] = useState("");
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [outputProject, setOutputProject] = useState("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState("Professional");
  const [detailLevel, setDetailLevel] = useState("Comprehensive");
  const [workspaceContext, setWorkspaceContext] = useState(false);
  const [clientId, setClientId] = useState("");
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [extractingDocument, setExtractingDocument] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [formError, setFormError] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const selectedTemplate = templates.find(({ id }) => id === template);
  const selectedMeeting = meetings?.find(({ id }) => id === meetingId);
  const templateVariables = templateVariableNames(selectedTemplate?.variables ?? []);
  const canGeneratePreview = Boolean(
    template && outputProject && title.trim() && meetingTranscriptReady(selectedMeeting)
  );

  const selectTemplate = (templateId: string) => {
    const item = templates.find(({ id }) => id === templateId);
    setTemplate(templateId);
    setVariableValues((current) => syncTemplateVariableValues(item?.variables ?? [], current));
    if (!title.trim() && item) setTitle(item.name);
  };

  const openGenerator = (templateId?: string) => {
    if (templateId) selectTemplate(templateId);
    setGeneratorOpen(true);
  };

  const updateVariable = (variable: string, value: string) => {
    setVariableValues((current) => ({ ...current, [variable]: value }));
  };

  const extractDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setExtractingDocument(true);
    setFormError("");
    try {
      const extracted = await summonService.extractAutomationContext(workspaceSlug, file);
      setBrief([brief.trim(), `[Document: ${extracted.name}]\n${extracted.text}`].filter(Boolean).join("\n\n"));
      setDocumentName(`${extracted.name}${extracted.truncated ? " (trimmed to 30,000 characters)" : ""}`);
    } catch (requestError) {
      setFormError(summonLLMErrorMessage(requestError));
    } finally {
      setExtractingDocument(false);
    }
  };

  const uploadMeetingAudio = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !meetingId) return;
    setUploadingAudio(true);
    setFormError("");
    let assetId = "";
    try {
      const asset = await fileService.uploadWorkspaceAsset(
        workspaceSlug,
        { entity_identifier: meetingId, entity_type: EFileAssetType.MEETING_RECORDING },
        file
      );
      assetId = asset.asset_id;
      await summonService.updateMeeting(workspaceSlug, meetingId, { recording_asset: assetId });
      await refresh();
    } catch (requestError) {
      if (assetId) await fileService.deleteWorkspaceAsset(workspaceSlug, assetId).catch(() => undefined);
      setFormError(summonLLMErrorMessage(requestError));
    } finally {
      setUploadingAudio(false);
    }
  };

  const generatePreview = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canGeneratePreview) return;
    setGenerating(true);
    setFormError("");
    try {
      const job = await summonService.generateAutomationPreview(workspaceSlug, {
        template,
        project: outputProject,
        input: {
          ...buildAutomationInput(selectedTemplate?.variables ?? [], title, brief, variableValues),
          tone,
          detail_level: detailLevel,
        },
        context: {
          workspace: workspaceContext,
          // The selected output project is also the project context source.
          project_id: outputProject,
          client_id: clientId || undefined,
          meeting_id: meetingId || undefined,
          page_ids: pageIds,
        },
      });
      await refresh();
      router.push(automationJobPath(workspaceSlug, job.id));
    } catch (requestError) {
      setFormError(summonLLMErrorMessage(requestError));
      await refresh();
    } finally {
      setGenerating(false);
    }
  };

  return {
    template,
    selectTemplate,
    generatorOpen,
    setGeneratorOpen,
    openGenerator,
    outputProject,
    setOutputProject,
    title,
    setTitle,
    brief,
    setBrief,
    tone,
    setTone,
    detailLevel,
    setDetailLevel,
    workspaceContext,
    setWorkspaceContext,
    clientId,
    setClientId,
    pageIds,
    setPageIds,
    generating,
    extractingDocument,
    uploadingAudio,
    documentName,
    formError,
    variableValues,
    updateVariable,
    selectedTemplate,
    selectedMeeting,
    templateVariables,
    canGeneratePreview,
    extractDocument,
    uploadMeetingAudio,
    generatePreview,
  };
}
