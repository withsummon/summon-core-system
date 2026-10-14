/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { ChatTextIcon, NotePencilIcon } from "@phosphor-icons/react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  Clock3,
  ExternalLink,
  Link2,
  LoaderCircle,
  PlayCircle,
  Upload,
  Video,
} from "lucide-react";
import type { ISummonMeeting } from "@plane/types";
import { getButtonStyling } from "@plane/propel/button";
import { Popover } from "@plane/propel/popover";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { AvatarGroup, Avatar } from "@plane/ui";
import { copyUrlToClipboard } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { ProjectDropdown } from "@/components/dropdowns/project/dropdown";
import { SectionTabs } from "@/components/summon/section-tabs";
import type { TSectionTab } from "@/components/summon/section-tabs";
import { StatusBadge } from "@/components/summon/status-badge";
import type { TSeek } from "./meeting-media";
import { MeetingNotes } from "./meeting-notes";
import { MeetingTranscript } from "./meeting-transcript";

type Props = {
  data: ISummonMeeting;
  workspaceSlug: string;
  summarizing: boolean;
  summaryError: string;
  uploadingRecording: boolean;
  onUploadRecording: (file: File) => void;
  onMoveToProject: (projectId: string) => void;
  onRegenerate: () => void;
};

type TPane = "notes" | "transcript";

/** Below xl the two panes share the space as tabs; from xl they sit side by side. */
const PANES: TSectionTab<TPane>[] = [
  { value: "notes", label: "Notes", icon: NotePencilIcon },
  { value: "transcript", label: "Transcript", icon: ChatTextIcon },
];

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const AUDIO_TYPES = "audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/webm,audio/ogg";

function durationLabel(startsAt: string, endsAt: string | null) {
  if (!endsAt) return null;
  const minutes = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000);
  if (minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  return minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`;
}

/** Who was in the meeting: the importer's invite list when there is one, else the linked members. */
function MeetingPeople({ data }: { data: ISummonMeeting }) {
  const people = data.attendees.length
    ? data.attendees.map((attendee) => ({
        key: attendee.email,
        name: attendee.name || attendee.email,
        email: attendee.email,
      }))
    : data.participants.map((participant) => ({
        key: participant.id,
        name: participant.member.display_name,
        email: "",
      }));
  if (!people.length) return null;
  return (
    <Popover>
      <Popover.Button className="inline-flex items-center gap-1.5 rounded-md hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong">
        <AvatarGroup size="sm" max={4} showTooltip={false}>
          {people.map((person) => (
            <Avatar key={person.key} name={person.name} />
          ))}
        </AvatarGroup>
        {people.length} {people.length === 1 ? "person" : "people"}
      </Popover.Button>
      <Popover.Panel
        placement="bottom-start"
        sideOffset={6}
        positionerClassName="z-[110]"
        className="max-h-80 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-subtle bg-surface-1 p-1.5 shadow-overlay-100"
      >
        <ul aria-label="People in this meeting">
          {people.map((person) => (
            <li key={person.key} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
              <Avatar name={person.name} size="base" showTooltip={false} />
              <span className="min-w-0">
                <span className="block truncate text-13 text-primary">{person.name}</span>
                {person.email && person.email !== person.name ? (
                  <span className="block truncate text-11 text-tertiary">{person.email}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Popover.Panel>
    </Popover>
  );
}

function UploadRecording({
  uploading,
  onUpload,
  children,
  className,
}: {
  uploading: boolean;
  onUpload: (file: File) => void;
  children: React.ReactNode;
  className: string;
}) {
  return (
    <label className={`cursor-pointer has-[:disabled]:cursor-progress ${className}`}>
      {children}
      <input
        type="file"
        accept={AUDIO_TYPES}
        disabled={uploading}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = "";
        }}
      />
    </label>
  );
}

export const MeetingDetailWorkspace = observer(function MeetingDetailWorkspace({
  data,
  workspaceSlug,
  summarizing,
  summaryError,
  uploadingRecording,
  onUploadRecording,
  onMoveToProject,
  onRegenerate,
}: Props) {
  const [pane, setPane] = useState<TPane>("notes");
  const [playhead, setPlayhead] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recordingUrl = data.recording_asset_detail?.url;
  const transcribing = data.summary_error === "transcribing";
  const duration = durationLabel(data.starts_at, data.ends_at);
  const startsAt = new Date(data.starts_at);

  // A moment plays from Summon's own recording; an imported meeting opens tl;dv, which keeps the video, at that moment.
  let seek: TSeek;
  if (recordingUrl) {
    seek = (seconds) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = seconds;
      void audio.play();
      setPane("transcript");
    };
  } else if (data.external_url) {
    seek = (seconds) => window.open(`${data.external_url}?t=${Math.floor(seconds)}`, "_blank", "noopener");
  }

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
      <div className="flex min-h-full flex-col bg-surface-1 xl:h-full">
        <header className="border-b border-subtle px-4 pt-3 sm:px-6 lg:px-8">
          <Link
            href={`/${workspaceSlug}/summon/meetings/`}
            className="inline-flex items-center gap-1 text-12 font-medium text-tertiary hover:text-primary"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" /> Meetings
          </Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1 basis-80">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-20 font-semibold tracking-tight break-words text-primary">{data.title}</h1>
                <StatusBadge status={data.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-12 text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-tertiary" aria-hidden="true" />
                  <time dateTime={data.starts_at}>{DATE_FORMATTER.format(startsAt)}</time>
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Clock3 className="size-3.5 text-tertiary" aria-hidden="true" />
                  {TIME_FORMATTER.format(startsAt)}
                  {data.ends_at ? `–${TIME_FORMATTER.format(new Date(data.ends_at))}` : ""}
                  {duration ? <span className="text-tertiary">· {duration}</span> : null}
                </span>
                <span className="-ml-1.5 inline-flex items-center">
                  <ProjectDropdown
                    value={data.project}
                    onChange={(projectId) => {
                      if (projectId !== data.project) onMoveToProject(projectId);
                    }}
                    multiple={false}
                    buttonVariant="transparent-with-text"
                    buttonClassName="h-6 px-1.5 text-12 text-secondary"
                    placeholder="No project"
                    dropdownArrow
                  />
                  {data.project_detail ? (
                    <Link
                      href={`/${workspaceSlug}/summon/projects/${data.project_detail.id}/`}
                      aria-label={`Open ${data.project_detail.name}`}
                      className="ml-1 grid size-5 place-items-center rounded-sm text-tertiary hover:bg-layer-1 hover:text-primary"
                    >
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  ) : null}
                </span>
                <MeetingPeople data={data} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {data.meeting_url ? (
                <a
                  href={data.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={getButtonStyling("secondary", "base")}
                >
                  <Link2 className="size-3.5" aria-hidden="true" /> Meeting link
                </a>
              ) : null}
              {data.external_url ? (
                <a
                  href={data.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={getButtonStyling("secondary", "base")}
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" /> Open in tl;dv
                </a>
              ) : null}
              <button type="button" onClick={() => void share()} className={getButtonStyling("primary", "base")}>
                Share
              </button>
            </div>
          </div>
          <SectionTabs
            items={PANES}
            value={pane}
            onValueChange={setPane}
            label="Meeting panes"
            className="mt-3 border-b-0 xl:hidden"
          />
          <div className="h-3 max-xl:hidden" />
        </header>

        <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,0.85fr)]">
          <section
            aria-label="Notes"
            className={`${pane === "notes" ? "" : "max-xl:hidden"} min-h-0 px-4 py-6 sm:px-6 lg:px-8 xl:overflow-y-auto`}
          >
            <div className="mx-auto max-w-3xl">
              <MeetingNotes
                data={data}
                workspaceSlug={workspaceSlug}
                onSeek={seek}
                summarizing={summarizing}
                summaryError={summaryError}
                onRegenerate={onRegenerate}
              />
            </div>
          </section>

          <section
            aria-label="Recording and transcript"
            className={`${pane === "transcript" ? "flex" : "max-xl:hidden xl:flex"} min-h-0 flex-col border-subtle bg-surface-2 xl:border-l`}
          >
            <div className="border-b border-subtle p-4">
              {recordingUrl ? (
                <div className="space-y-2">
                  <audio
                    ref={audioRef}
                    controls
                    preload="metadata"
                    src={recordingUrl}
                    className="h-10 w-full"
                    onTimeUpdate={(event) => setPlayhead(event.currentTarget.currentTime)}
                  >
                    <track kind="captions" />
                  </audio>
                  <UploadRecording
                    uploading={uploadingRecording}
                    onUpload={onUploadRecording}
                    className="inline-flex items-center gap-1.5 text-12 text-tertiary hover:text-primary"
                  >
                    <Upload className="size-3.5" aria-hidden="true" />
                    {uploadingRecording ? "Uploading…" : "Replace recording"}
                  </UploadRecording>
                </div>
              ) : data.external_url ? (
                <div className="flex items-center gap-3 rounded-lg border border-subtle bg-surface-1 p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-layer-1 text-secondary">
                    <Video className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-13 font-medium text-primary">Recording in tl;dv</p>
                    <p className="text-12 text-tertiary">Timestamps open the video at that moment.</p>
                  </div>
                  <a
                    href={data.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={getButtonStyling("secondary", "sm")}
                  >
                    <PlayCircle className="size-3.5" aria-hidden="true" /> Watch
                  </a>
                </div>
              ) : transcribing ? (
                <p className="flex items-center gap-2 text-13 text-secondary" role="status">
                  <LoaderCircle className="size-4 animate-spin text-accent-primary" aria-hidden="true" />
                  Transcribing the recording…
                </p>
              ) : (
                <UploadRecording
                  uploading={uploadingRecording}
                  onUpload={onUploadRecording}
                  className="flex items-center gap-3 rounded-lg border border-dashed border-strong bg-surface-1 p-3 focus-within:outline-2 focus-within:outline-accent-strong hover:bg-layer-transparent-hover"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-subtle text-accent-primary">
                    {uploadingRecording ? (
                      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Upload className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-13 font-medium text-primary">
                      {uploadingRecording ? "Uploading…" : "Upload the recording"}
                    </span>
                    <span className="block text-12 text-tertiary">Audio is transcribed with timestamps.</span>
                  </span>
                </UploadRecording>
              )}
            </div>
            <div className="min-h-0 flex-1 p-4 xl:overflow-y-auto">
              {data.transcript_segments.length ? (
                <MeetingTranscript segments={data.transcript_segments} onSeek={seek} playhead={playhead} />
              ) : (
                <p className="py-10 text-center text-12 text-tertiary">
                  {transcribing ? "The transcript appears here when transcription finishes." : "No transcript yet."}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
});
