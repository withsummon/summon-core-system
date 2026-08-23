/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { MeetingDetailWorkspace } from "@/components/summon/meetings/meeting-detail-workspace";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonLLMErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonMeetingDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, meetingId } = params;
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-meeting", workspaceSlug, meetingId], () =>
    summonService.getMeeting(workspaceSlug, meetingId)
  );

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
      onRegenerate={() => void regenerateSummary()}
    />
  );
}
