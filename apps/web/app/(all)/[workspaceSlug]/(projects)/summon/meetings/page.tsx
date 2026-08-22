/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { Button, Input } from "@plane/ui";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import {
  SummonCard,
  SummonMetric,
  SummonRecordList,
  SummonScreen,
  summonErrorMessage,
} from "@/components/summon/screen";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonMeetingsPage({ params }: Route.ComponentProps) {
  const { joinedProjectIds, getProjectById } = useProject();
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [project, setProject] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [issueId, setIssueId] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const {
    data = [],
    error,
    isLoading,
    mutate,
  } = useSWR(["summon-meetings", params.workspaceSlug], () => summonService.listMeetings(params.workspaceSlug));

  const createMeeting = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await summonService.createMeeting(params.workspaceSlug, {
        title,
        starts_at: new Date(startsAt).toISOString(),
        project: project || null,
      });
      setTitle("");
      setStartsAt("");
      await mutate();
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };
  const linkIssue = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await summonService.linkMeetingIssue(params.workspaceSlug, meetingId, issueId);
      setIssueId("");
      await mutate();
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SummonScreen
      title="Meeting Workspace"
      description="Schedules and notes live in Summon; every action item is a live Plane work item."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummonMetric label="All meetings" value={data.length} detail="Workspace schedule" />
        <SummonMetric
          label="Scheduled"
          value={data.filter(({ status }) => status === "scheduled").length}
          detail="Upcoming sessions"
        />
        <SummonMetric
          label="Action items"
          value={data.reduce((total, item) => total + item.work_items.length, 0)}
          detail="Live Plane work items"
        />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          <SummonRequestState
            loading={isLoading}
            error={error}
            empty={!isLoading && data.length === 0}
            onRetry={() => void mutate()}
          />
          {data.length ? (
            <SummonRecordList
              records={data.map((item) => ({
                id: item.id,
                title: item.title,
                detail: `${new Date(item.starts_at).toLocaleString()} · ${item.work_items.length} Plane actions`,
                badge: item.status,
              }))}
            />
          ) : null}
        </div>
        <div className="space-y-4">
          <SummonCard>
            <h2 className="text-sm font-semibold text-primary">Schedule meeting</h2>
            <form onSubmit={createMeeting} className="mt-4 grid gap-3">
              <SummonField label="Title">
                <Input required value={title} onChange={(event) => setTitle(event.target.value)} />
              </SummonField>
              <SummonField label="Starts at">
                <Input
                  required
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </SummonField>
              <SummonField label="Plane Project">
                <SummonSelect value={project} onChange={(event) => setProject(event.target.value)}>
                  <option value="">Workspace meeting</option>
                  {joinedProjectIds.map((id) => (
                    <option key={id} value={id}>
                      {getProjectById(id)?.name ?? id}
                    </option>
                  ))}
                </SummonSelect>
              </SummonField>
              <Button type="submit" loading={saving}>
                Create meeting
              </Button>
            </form>
          </SummonCard>
          <SummonCard>
            <h2 className="text-sm font-semibold text-primary">Link Plane action item</h2>
            <form onSubmit={linkIssue} className="mt-4 grid gap-3">
              <SummonField label="Meeting">
                <SummonSelect required value={meetingId} onChange={(event) => setMeetingId(event.target.value)}>
                  <option value="">Select meeting</option>
                  {data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </SummonSelect>
              </SummonField>
              <SummonField label="Plane work item ID">
                <Input
                  required
                  value={issueId}
                  onChange={(event) => setIssueId(event.target.value)}
                  placeholder="UUID from the work item URL"
                />
              </SummonField>
              <Button type="submit" loading={saving}>
                Link work item
              </Button>
            </form>
          </SummonCard>
          {formError ? <p className="text-xs text-danger-primary">{formError}</p> : null}
        </div>
      </div>
    </SummonScreen>
  );
}
