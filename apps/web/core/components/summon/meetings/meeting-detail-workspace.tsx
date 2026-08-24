/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Download,
  Ellipsis,
  FolderKanban,
  MapPin,
  Search,
  Share2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import type { ISummonMeeting } from "@plane/types";
import { Avatar } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { copyUrlToClipboard } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { MeetingDetailMeta } from "./meeting-detail-meta";
import { MeetingDetailRail } from "./meeting-detail-rail";

type Props = {
  data: ISummonMeeting;
  workspaceSlug: string;
  summarizing: boolean;
  summaryError: string;
  uploadingRecording: boolean;
  onUploadRecording: (file: File) => void;
  onRegenerate: () => void;
};

const tabs = [
  ["Overview", "overview"],
  ["Transcript", "transcript"],
  ["AI Summary", "ai-summary"],
  ["Documents", "documents"],
  ["Tasks", "tasks"],
  ["Activity", "activity"],
] as const;

const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(value));

function Card(props: { id?: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={props.id} className="shadow-sm scroll-mt-24 rounded-xl border border-subtle bg-surface-1">
      <div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3.5">
        <h2 className="text-sm font-semibold text-primary">{props.title}</h2>
        {props.action}
      </div>
      <div className="p-4">{props.children}</div>
    </section>
  );
}

export const MeetingDetailWorkspace = observer(function MeetingDetailWorkspace({
  data,
  workspaceSlug,
  summarizing,
  summaryError,
  uploadingRecording,
  onUploadRecording,
  onRegenerate,
}: Props) {
  const { sidebarCollapsed } = useAppTheme();
  const [search, setSearch] = useState("");
  const [showAllTranscript, setShowAllTranscript] = useState(false);
  const organizer = data.participants.find(({ member }) => member.id === data.organizer)?.member.display_name;
  const transcript = useMemo(() => {
    const occurrences = new Map<string, number>();

    return data.transcript_text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line && line.toLowerCase().includes(search.trim().toLowerCase()))
      .map((line) => {
        const occurrence = (occurrences.get(line) ?? 0) + 1;
        occurrences.set(line, occurrence);
        return { id: `${line}-${occurrence}`, line };
      });
  }, [data.transcript_text, search]);
  const visibleTranscript = showAllTranscript ? transcript : transcript.slice(0, 6);
  const share = async () => {
    try {
      await copyUrlToClipboard(window.location.pathname);
      setToast({ type: TOAST_TYPE.INFO, title: "Link copied", message: "Meeting link copied to clipboard." });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Copy failed", message: "The meeting link could not be copied." });
    }
  };

  return (
    <>
      <PageHead title={`${data.title} · Summon Core`} />
      <main id="overview" className="mx-auto min-h-full w-full max-w-[1680px] bg-surface-2">
        <header className="border-b border-subtle bg-surface-1 px-5 pt-4 lg:px-8">
          <div className="flex items-center gap-2 text-[11px] font-medium text-secondary">
            {sidebarCollapsed ? <AppSidebarToggleButton /> : null}
            <Link href={`/${workspaceSlug}/summon/meetings/`} className="hover:text-primary">
              Meetings
            </Link>
            <span>›</span>
            <span className="text-primary">Meeting Workspace</span>
          </div>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight text-primary">{data.title}</h1>
                <span className="rounded-md bg-accent-subtle px-2 py-1 text-[10px] font-semibold text-accent-primary capitalize">
                  {data.status}
                </span>
              </div>
              <div className="text-xs mt-2 flex items-center gap-1.5 font-medium text-secondary">
                <FolderKanban className="size-3.5" />
                {data.project_detail ? (
                  <Link
                    href={`/${workspaceSlug}/summon/projects/${data.project_detail.id}/`}
                    className="hover:text-accent-primary"
                  >
                    {data.project_detail.name}
                  </Link>
                ) : (
                  "Workspace meeting"
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-secondary">
                <Meta icon={CalendarDays}>{date(data.starts_at)}</Meta>
                <Meta icon={Clock3}>
                  {time(data.starts_at)}
                  {data.ends_at ? ` – ${time(data.ends_at)}` : ""}
                </Meta>
                <Meta icon={MapPin}>{data.location || "Location not supplied"}</Meta>
                <Meta icon={Users}>{data.participants.length} Participants</Meta>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/${workspaceSlug}/settings/members/`}
                className="text-xs shadow-xs inline-flex h-9 items-center gap-2 rounded-lg border border-subtle bg-surface-1 px-3 font-semibold text-primary hover:bg-layer-1"
              >
                <UserPlus className="size-3.5" /> Invite People
              </Link>
              <details className="relative">
                <summary className="shadow-xs grid size-9 cursor-pointer list-none place-items-center rounded-lg border border-subtle bg-surface-1 text-secondary hover:bg-layer-1">
                  <Ellipsis className="size-4" />
                </summary>
                <div className="shadow-lg absolute right-0 z-20 mt-1 w-44 rounded-lg border border-subtle bg-surface-1 p-1">
                  {data.meeting_url ? (
                    <a
                      href={data.meeting_url}
                      className="text-xs block rounded-md px-3 py-2 text-primary hover:bg-layer-1"
                    >
                      Open meeting link
                    </a>
                  ) : null}
                  <Link
                    href={`/${workspaceSlug}/summon/meetings/`}
                    className="text-xs block rounded-md px-3 py-2 text-primary hover:bg-layer-1"
                  >
                    All meetings
                  </Link>
                </div>
              </details>
              <button
                type="button"
                onClick={() => void share()}
                className="text-xs shadow-sm inline-flex h-9 items-center gap-2 rounded-lg bg-accent-primary px-4 font-semibold text-white hover:bg-accent-primary/90"
              >
                <Share2 className="size-3.5" /> Share
              </button>
            </div>
          </div>
          <nav className="mt-5 flex gap-6 overflow-x-auto" aria-label="Meeting detail sections">
            {tabs.map(([label, id], index) => (
              <a
                key={id}
                href={`#${id}`}
                className={`text-xs border-b-2 px-1 pb-3 font-medium whitespace-nowrap ${
                  index === 0 ? "border-accent-primary text-accent-primary" : "border-transparent text-secondary"
                }`}
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        <div className="grid items-start gap-4 p-4 lg:p-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(23rem,0.95fr)]">
          <div className="space-y-4">
            <Card
              title="Recording"
              action={
                <div className="flex items-center gap-2">
                  {data.recording_asset_detail?.url ? (
                    <a
                      href={data.recording_asset_detail.url}
                      download
                      className="inline-flex items-center gap-1.5 rounded-lg border border-subtle px-3 py-1.5 text-[11px] font-semibold text-primary"
                    >
                      <Download className="size-3.5" /> Download
                    </a>
                  ) : null}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-subtle px-3 py-1.5 text-[11px] font-semibold text-primary">
                    <Upload className="size-3.5" /> {uploadingRecording ? "Uploading…" : "Upload audio"}
                    <input
                      type="file"
                      accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/webm,audio/ogg"
                      disabled={uploadingRecording}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onUploadRecording(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
              }
            >
              {data.recording_asset_detail?.url ? (
                <audio controls preload="metadata" className="h-10 w-full" src={data.recording_asset_detail.url}>
                  <track kind="captions" />
                </audio>
              ) : (
                <p className="text-xs text-tertiary">
                  {data.summary_error === "transcribing" ? "Audio sedang ditranskripsi…" : "No recording attached."}
                </p>
              )}
            </Card>

            <Card
              id="transcript"
              title="Transcript"
              action={
                <div className="flex items-center gap-2">
                  <label className="relative hidden sm:block">
                    <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-placeholder" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search in transcript..."
                      className="focus:border-accent-primary h-8 w-56 rounded-lg border border-subtle bg-surface-1 pr-3 pl-8 text-[11px] text-primary outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    disabled
                    title="Speaker labels are not available for this transcript"
                    className="inline-flex h-8 cursor-not-allowed items-center gap-2 rounded-lg border border-subtle px-3 text-[11px] text-secondary opacity-60"
                  >
                    All Speakers <ChevronDown className="size-3" />
                  </button>
                </div>
              }
            >
              {visibleTranscript.length ? (
                <div className="divide-y divide-subtle">
                  {visibleTranscript.map(({ id, line }) => (
                    <div key={id} className="grid gap-3 py-3 first:pt-0 sm:grid-cols-[10rem_1fr]">
                      <div className="flex items-center gap-2.5">
                        <Avatar size={28} name="Transcript" />
                        <div>
                          <p className="text-[11px] font-semibold text-primary">Transcript</p>
                          <p className="text-[10px] text-tertiary">Speaker not identified</p>
                        </div>
                      </div>
                      <p className="text-xs leading-5 text-secondary">{line}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs py-3 text-tertiary">No matching transcript text.</p>
              )}
              {transcript.length > 6 ? (
                <button
                  type="button"
                  onClick={() => setShowAllTranscript((value) => !value)}
                  className="mx-auto mt-3 flex items-center gap-1 text-[11px] font-semibold text-secondary"
                >
                  {showAllTranscript ? "Show Less" : "Show More"} <ChevronDown className="size-3" />
                </button>
              ) : null}
            </Card>

            <MeetingDetailMeta
              data={data}
              organizer={organizer}
              createdAt={`${date(data.created_at)}, ${time(data.created_at)}`}
            />
          </div>
          <MeetingDetailRail
            data={data}
            workspaceSlug={workspaceSlug}
            summarizing={summarizing}
            summaryError={summaryError}
            onRegenerate={onRegenerate}
          />
        </div>
      </main>
    </>
  );
});

function Meta({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-tertiary" /> {children}
    </span>
  );
}
