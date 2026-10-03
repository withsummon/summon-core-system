/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import type { WorkspaceSession } from "@/app/native-workspace";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/ui";
import { SummonField } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonMetric, SummonScreen } from "@/components/summon/screen";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { Select } from "@plane/propel/select";
import { DatePicker } from "@plane/propel/date-picker";

export default function SummonMeetingsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { workspace } = session;
  const commands = useStickiesCommands();
  const [searchParams] = useSearchParams();
  const projects = useQuery(api.projects.index.list, { workspaceId: workspace._id });
  const {
    results: meetingContributions,
    status: meetingCountStatus,
    loadMore: loadMeetingCounts,
  } = usePaginatedQuery(
    api.meetings.index.counts,
    { workspaceId: workspace._id, kind: "meetings" },
    { initialNumItems: 100 }
  );
  const {
    results: taskContributions,
    status: taskCountStatus,
    loadMore: loadTaskCounts,
  } = usePaginatedQuery(
    api.meetings.index.counts,
    { workspaceId: workspace._id, kind: "tasks" },
    { initialNumItems: 100 }
  );
  useEffect(() => {
    if (meetingCountStatus === "CanLoadMore") loadMeetingCounts(100);
    if (taskCountStatus === "CanLoadMore") loadTaskCounts(100);
  }, [meetingCountStatus, loadMeetingCounts, taskCountStatus, loadTaskCounts]);
  const countsComplete = meetingCountStatus === "Exhausted" && taskCountStatus === "Exhausted";
  const actionItemCounts = new Map<(typeof taskContributions)[number]["meetingId"], number>();
  for (const contribution of taskContributions)
    actionItemCounts.set(
      contribution.meetingId,
      (actionItemCounts.get(contribution.meetingId) ?? 0) + contribution.actionItems
    );
  const save = useMutation(api.meetings.index.save);
  const link = useMutation(api.meetings.tasks.linkById);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [project, setProject] = useState(() => searchParams.get("project") || "");
  const [meetingId, setMeetingId] = useState("");
  const [issueId, setIssueId] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const meetings = usePaginatedQuery(api.meetings.index.list, { workspaceId: workspace._id }, { initialNumItems: 30 });
  const canWrite = workspace.membershipRole !== "guest";
  const selectedProject = projects?.find((item) => item._id === project && item.membershipRole !== "guest");
  const selectedMeeting = meetings.results.find((item) => item._id === meetingId);

  const createMeeting = async (event: React.FormEvent) => {
    event.preventDefault();
    if (project && !selectedProject) {
      setFormError("Choose an available project.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await save({
        workspaceId: workspace._id,
        data: {
          title,
          startsAt: new Date(startsAt).getTime(),
          endsAt: null,
          projectId: selectedProject?._id ?? null,
          agenda: "",
          notes: "",
          location: "",
          meetingUrl: "",
          status: "scheduled",
          summaryDocumentId: null,
        },
        participantIds: [],
      });
      setTitle("");
      setStartsAt("");
    } catch (requestError) {
      setFormError(mutationMessage(requestError));
    } finally {
      setSaving(false);
    }
  };
  const linkIssue = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedMeeting) {
      setFormError("Choose an available meeting.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await link({ workspaceId: workspace._id, meetingId: selectedMeeting._id, taskId: issueId });
      setIssueId("");
    } catch (requestError) {
      setFormError(mutationMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      <div className="h-full min-h-0 overflow-x-hidden overflow-y-auto bg-surface-2">
        <SummonScreen
          title="Meeting Workspace"
          description="Schedules and notes live in Summon; every action item is a live Plane work item."
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <SummonMetric
              label="All meetings"
              value={countsComplete ? meetingContributions.reduce((total, row) => total + row.total, 0) : "—"}
              detail="Workspace schedule"
            />
            <SummonMetric
              label="Scheduled"
              value={countsComplete ? meetingContributions.reduce((total, row) => total + row.scheduled, 0) : "—"}
              detail="Upcoming sessions"
            />
            <SummonMetric
              label="Action items"
              value={countsComplete ? taskContributions.reduce((total, row) => total + row.actionItems, 0) : "—"}
              detail="Live Plane work items"
            />
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-3">
              <SummonRequestState
                loading={meetings.status === "LoadingFirstPage"}
                empty={meetings.status === "Exhausted" && meetings.results.length === 0}
              />
              {meetings.results.length ? (
                <div className="divide-y divide-subtle overflow-hidden rounded-2xl border border-subtle bg-surface-1">
                  {meetings.results.map((item) => (
                    <Link
                      key={item._id}
                      to={`/${workspace.slug}/summon/meetings/${item._id}/`}
                      className="block px-3.5 py-2.5 hover:bg-layer-1"
                    >
                      <p className="text-sm font-medium text-primary">{item.title}</p>
                      <p className="text-xs mt-1 text-secondary">
                        {new Date(item.startsAt).toLocaleString()} ·{" "}
                        {countsComplete ? (actionItemCounts.get(item._id) ?? 0) : "—"} Plane actions · {item.status}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : null}
              {meetings.status === "CanLoadMore" && (
                <Button variant="secondary" onClick={() => meetings.loadMore(30)}>
                  Load more meetings
                </Button>
              )}
              {meetings.status === "LoadingMore" && <p role="status">Loading more meetings…</p>}
            </div>
            <div className="space-y-4">
              <SummonCard>
                <h2 className="text-sm font-semibold text-primary">Schedule meeting</h2>
                <form onSubmit={createMeeting} className="mt-4">
                  <fieldset disabled={saving || !canWrite || projects === undefined} className="grid min-w-0 gap-3">
                    <SummonField label="Title">
                      <Input required value={title} onChange={(event) => setTitle(event.target.value)} />
                    </SummonField>
                    <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                      <SummonField label="Start date">
                        <DatePicker
                          required
                          clearable={false}
                          value={startsAt.slice(0, 10)}
                          onValueChange={(date) =>
                            setStartsAt(date ? `${date}T${startsAt.slice(11, 16) || "09:00"}` : "")
                          }
                        />
                      </SummonField>
                      <SummonField label="Time">
                        <Input
                          required
                          type="time"
                          value={startsAt.slice(11, 16)}
                          disabled={!startsAt}
                          onChange={(event) => setStartsAt(`${startsAt.slice(0, 10)}T${event.target.value}`)}
                        />
                      </SummonField>
                    </div>
                    <SummonField label="Plane Project">
                      <Select
                        value={project}
                        onValueChange={(value) => setProject(value)}
                        options={[
                          { value: "", label: "Workspace meeting" },
                          ...(projects ?? [])
                            .filter((item) => item.membershipRole !== "guest")
                            .map((item) => ({ value: item._id, label: item.name })),
                        ]}
                      />
                    </SummonField>
                    <Button size="xl" type="submit" loading={saving}>
                      Create meeting
                    </Button>
                  </fieldset>
                </form>
              </SummonCard>
              <SummonCard>
                <h2 className="text-sm font-semibold text-primary">Link Plane action item</h2>
                <form onSubmit={linkIssue} className="mt-4">
                  <fieldset disabled={saving || !canWrite} className="grid min-w-0 gap-3">
                    <SummonField label="Meeting">
                      <Select
                        required
                        value={meetingId}
                        onValueChange={(value) => setMeetingId(value)}
                        options={[
                          { value: "", label: "Select meeting" },
                          ...meetings.results.map((item) => ({ value: item._id, label: item.title })),
                        ]}
                      />
                    </SummonField>
                    <SummonField label="Plane work item ID">
                      <Input
                        required
                        value={issueId}
                        onChange={(event) => setIssueId(event.target.value)}
                        placeholder="ID from the work item URL"
                      />
                    </SummonField>
                    <Button size="xl" type="submit" loading={saving}>
                      Link work item
                    </Button>
                  </fieldset>
                </form>
              </SummonCard>
              {formError ? (
                <p role="alert" className="text-xs text-danger-primary">
                  {formError}
                </p>
              ) : null}
            </div>
          </div>
        </SummonScreen>
      </div>
    </PreservedWorkspaceShell>
  );
}
