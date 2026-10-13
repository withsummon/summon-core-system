/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import type { ISummonAutomationJob } from "@plane/types";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonScreen, summonLLMErrorMessage } from "@/components/summon/screen";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import { automationInputValue } from "../automation-form";
import { templateLabel } from "../automation-display";
import {
  AutomationJobActionsPanel,
  AutomationJobFilesPanel,
  AutomationJobPreviewCard,
  AutomationJobSourcesPanel,
} from "./job-detail-panels";

function useAutomationJobAction(action: () => Promise<unknown>, setActionError: (error: string) => void) {
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    setActionError("");
    try {
      await action();
    } catch (requestError) {
      setActionError(summonLLMErrorMessage(requestError));
    } finally {
      setRunning(false);
    }
  };
  return [running, run] as const;
}

function SummonAutomationJobDetail(props: {
  workspaceSlug: string;
  data: ISummonAutomationJob;
  refresh: () => Promise<unknown>;
}) {
  const { workspaceSlug, data, refresh } = props;
  const { getProjectById } = useProject();
  const [actionError, setActionError] = useState("");
  const [rendering, renderFiles] = useAutomationJobAction(async () => {
    await summonService.renderAutomationJob(workspaceSlug, data.id);
    await refresh();
  }, setActionError);
  const [publishing, publishPage] = useAutomationJobAction(async () => {
    await summonService.publishAutomationJob(workspaceSlug, data.id);
    await refresh();
  }, setActionError);

  const title = automationInputValue(data.input, "title") || templateLabel(data.type);
  const projectName = data.project ? getProjectById(data.project)?.name || data.project : "No project";
  const pageArtifact = data.artifacts.find(({ page_detail }) => page_detail);
  const fileArtifacts = data.artifacts.filter(({ file_detail }) => file_detail);
  const hasPreview = data.status === "completed" && Boolean(data.preview_markdown);
  const canGenerateFiles = hasPreview && !fileArtifacts.length;
  const canPublish = hasPreview && !pageArtifact;
  const status = data.provider || data.error_summary || data.status;

  const generateFiles = async () => {
    if (!canGenerateFiles) return;
    await renderFiles();
  };

  const publishPreview = async () => {
    if (!canPublish) return;
    if (!window.confirm(`Publish ${title} from ${projectName} as a page?`)) return;
    await publishPage();
  };

  return (
    <SummonScreen
      title={title}
      description={`${projectName} · ${status}${data.model ? ` · ${data.model}` : ""}`}
      actions={
        <Link
          href={`/${workspaceSlug}/summon/automation/`}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-subtle bg-surface-1 px-3 text-xs font-medium text-primary"
        >
          <ArrowLeft className="size-3.5" /> Generated documents
        </Link>
      }
    >
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <AutomationJobPreviewCard data={data} />

        <aside className="space-y-4">
          <AutomationJobActionsPanel
            canGenerateFiles={canGenerateFiles}
            canPublish={canPublish}
            rendering={rendering}
            publishing={publishing}
            actionError={actionError}
            onGenerateFiles={() => void generateFiles()}
            onPublish={() => void publishPreview()}
          />
          <AutomationJobFilesPanel fileArtifacts={fileArtifacts} pageArtifact={pageArtifact} />
          <AutomationJobSourcesPanel citations={data.citations} />
        </aside>
      </div>
    </SummonScreen>
  );
}

export default function SummonAutomationDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, jobId } = params;
  const { data, error, isLoading, mutate } = useSWR(["summon-automation-job", workspaceSlug, jobId], () =>
    summonService.getAutomationJob(workspaceSlug, jobId)
  );

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  return <SummonAutomationJobDetail workspaceSlug={workspaceSlug} data={data} refresh={mutate} />;
}
