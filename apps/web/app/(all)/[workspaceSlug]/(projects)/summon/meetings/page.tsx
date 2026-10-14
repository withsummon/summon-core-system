/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Link2, ListChecks, Plus } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/ui";
import { SummonField } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonDrawer } from "@/components/summon/drawer";
import { StatusBadge } from "@/components/summon/status-badge";
import {
  SummonMetric,
  SummonMetricStrip,
  SummonScreen,
  SummonTableShell,
  summonErrorMessage,
} from "@/components/summon/screen";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";
import { Select } from "@plane/propel/select";
import { DatePicker } from "@plane/propel/date-picker";
import { renderFormattedDate, renderFormattedTime } from "@plane/utils";

/** "Thu 15 Oct · 14:00 WIB"; the year appears only outside the current one. en-ID names Indonesian zones (WIB/WITA/WIT). */
const TIME_ZONE_NAME_FORMATTER = new Intl.DateTimeFormat("en-ID", { timeZoneName: "short" });

const meetingTime = (value: string) => {
  const date = new Date(value);
  const zone = TIME_ZONE_NAME_FORMATTER.formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  const day = renderFormattedDate(
    date,
    date.getFullYear() === new Date().getFullYear() ? "EEE d MMM" : "EEE d MMM yyyy"
  );
  return `${day} · ${renderFormattedTime(date)}${zone ? ` ${zone}` : ""}`;
};

const actionItemsLabel = (count: number) =>
  count ? `${count} action ${count === 1 ? "item" : "items"}` : "No action items";

export default function SummonMeetingsPage({ params }: Route.ComponentProps) {
  const searchParams = useSearchParams();
  const { joinedProjectIds, getProjectById } = useProject();
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [project, setProject] = useState(() => searchParams.get("project") || "");
  const [meetingId, setMeetingId] = useState("");
  const [issueId, setIssueId] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState<"schedule" | "link" | null>(null);
  const openPanel = (next: "schedule" | "link" | null) => {
    setFormError("");
    setPanel(next);
  };
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
      setPanel(null);
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
      setPanel(null);
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
      description="Meeting schedules, notes and the tasks that come out of them."
      actions={
        <>
          <Button variant="secondary" size="lg" onClick={() => openPanel("link")} disabled={!data.length}>
            <Link2 />
            Link action item
          </Button>
          <Button size="lg" onClick={() => openPanel("schedule")}>
            <Plus />
            Schedule meeting
          </Button>
        </>
      }
    >
      <SummonMetricStrip>
        <SummonMetric label="All meetings" value={data.length} />
        <SummonMetric label="Scheduled" value={data.filter(({ status }) => status === "scheduled").length} />
        <SummonMetric
          label="Action items"
          value={data.reduce((total, item) => total + item.work_items.length, 0)}
          detail="Linked tasks"
        />
      </SummonMetricStrip>
      <div className="space-y-3">
        <SummonRequestState
          loading={isLoading}
          error={error}
          empty={!isLoading && data.length === 0}
          emptyAsset="meeting"
          emptyTitle="No meetings yet"
          emptyMessage="Schedule a meeting to keep its notes and action items together."
          onRetry={() => void mutate()}
        />
        {data.length ? (
          <SummonTableShell>
            <ul className="divide-y divide-subtle">
              {data.map((item) => (
                <li
                  key={item.id}
                  className="relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-layer-transparent-hover has-[a:focus-visible]:bg-layer-transparent-hover"
                >
                  <div className="min-w-0 flex-1">
                    {/* The title link stretches over the row. */}
                    <Link
                      href={`/${params.workspaceSlug}/summon/meetings/${item.id}/`}
                      className="block text-13 font-medium break-words text-primary outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent-strong"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-12 text-secondary">
                      <time dateTime={item.starts_at} className="whitespace-nowrap tabular-nums">
                        {meetingTime(item.starts_at)}
                      </time>
                      {item.project_detail ? (
                        <span className="max-w-48 truncate" title={item.project_detail.name}>
                          {item.project_detail.name}
                        </span>
                      ) : null}
                      <span className={`flex items-center gap-1 ${item.work_items.length ? "" : "text-tertiary"}`}>
                        <ListChecks aria-hidden="true" className="size-3.5" />
                        {actionItemsLabel(item.work_items.length)}
                      </span>
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          </SummonTableShell>
        ) : null}
      </div>

      <SummonDrawer
        open={panel === "schedule"}
        onOpenChange={(open) => openPanel(open ? "schedule" : null)}
        title="Schedule meeting"
      >
        <form onSubmit={createMeeting} className="grid gap-3">
          <SummonField label="Title">
            <Input required value={title} onChange={(event) => setTitle(event.target.value)} />
          </SummonField>
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
            <SummonField label="Start date">
              <DatePicker
                required
                clearable={false}
                value={startsAt.slice(0, 10)}
                onValueChange={(date) => setStartsAt(date ? `${date}T${startsAt.slice(11, 16) || "09:00"}` : "")}
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
          <SummonField label="Project">
            <Select
              value={project}
              onValueChange={(value) => setProject(value)}
              options={[
                { value: "", label: "Workspace meeting" },
                ...joinedProjectIds.map((id) => ({ value: id, label: getProjectById(id)?.name ?? id })),
              ]}
            />
          </SummonField>
          {formError ? <p className="text-12 text-danger-primary">{formError}</p> : null}
          <Button size="lg" type="submit" loading={saving}>
            Create meeting
          </Button>
        </form>
      </SummonDrawer>
      <SummonDrawer
        open={panel === "link"}
        onOpenChange={(open) => openPanel(open ? "link" : null)}
        title="Link an action item"
        description="Attach an existing task to a meeting."
      >
        <form onSubmit={linkIssue} className="grid gap-3">
          <SummonField label="Meeting">
            <Select
              required
              value={meetingId}
              onValueChange={(value) => setMeetingId(value)}
              options={[
                { value: "", label: "Select meeting" },
                ...data.map((item) => ({ value: item.id, label: item.title })),
              ]}
            />
          </SummonField>
          <SummonField label="Task ID">
            <Input
              required
              value={issueId}
              onChange={(event) => setIssueId(event.target.value)}
              placeholder="Copy it from the task's link"
            />
          </SummonField>
          {formError ? <p className="text-12 text-danger-primary">{formError}</p> : null}
          <Button size="lg" type="submit" loading={saving}>
            Link task
          </Button>
        </form>
      </SummonDrawer>
    </SummonScreen>
  );
}
