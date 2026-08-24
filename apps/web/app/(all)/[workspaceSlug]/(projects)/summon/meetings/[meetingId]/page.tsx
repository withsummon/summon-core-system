/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { EFileAssetType } from "@plane/types";
import { MeetingDetailWorkspace } from "@/components/summon/meetings/meeting-detail-workspace";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonLLMErrorMessage } from "@/components/summon/screen";
import { FileService } from "@/services/file.service";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

const fileService = new FileService();

export default function SummonMeetingDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, meetingId } = params;
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [uploadingRecording, setUploadingRecording] = useState(false);
  const { data, error, isLoading, mutate } = useSWR(
    ["summon-meeting", workspaceSlug, meetingId],
    () => summonService.getMeeting(workspaceSlug, meetingId),
    { refreshInterval: (meeting) => (meeting?.summary_error === "transcribing" ? 3000 : 0) }
  );

  const uploadRecording = async (file: File) => {
    setUploadingRecording(true);
    setSummaryError("");
    let assetId = "";
    try {
      const asset = await fileService.uploadWorkspaceAsset(
        workspaceSlug,
        { entity_identifier: meetingId, entity_type: EFileAssetType.MEETING_RECORDING },
        file
      );
      assetId = asset.asset_id;
      await summonService.updateMeeting(workspaceSlug, meetingId, { recording_asset: assetId });
      await mutate();
    } catch (requestError) {
      if (assetId) await fileService.deleteWorkspaceAsset(workspaceSlug, assetId).catch(() => undefined);
      setSummaryError(summonLLMErrorMessage(requestError));
    } finally {
      setUploadingRecording(false);
    }
  };

  const regenerateSummary = async () => {
    if (!data) return;
    setSummarizing(true);
    setSummaryError("");
    try {
      await summonService.summarizeMeeting(workspaceSlug, meetingId, {
        transcript_source: data.transcript_text ? "text" : "asset",
        context: { project_id: data.project ?? undefined },
      });
      await mutate();
    } catch (requestError) {
      setSummaryError(summonLLMErrorMessage(requestError));
    } finally {
      setSummarizing(false);
    }
  };

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  return (
    <MeetingDetailWorkspace
      data={data}
      workspaceSlug={workspaceSlug}
      summarizing={summarizing}
      summaryError={summaryError}
      uploadingRecording={uploadingRecording}
      onUploadRecording={(file) => void uploadRecording(file)}
      onRegenerate={() => void regenerateSummary()}
    />
  );
}
