/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@plane/propel/select";
import type { ISummonMeeting } from "@plane/types";
import { SummonSearchField } from "@/components/summon/search-field";
import { SpeakerAvatar, TimestampButton } from "./meeting-media";
import type { TSeek } from "./meeting-media";

type TSegment = ISummonMeeting["transcript_segments"][number];

type Props = {
  segments: TSegment[];
  onSeek: TSeek;
  /** Playback position in seconds while the recording plays here, so the spoken line stays in view. */
  playhead: number | null;
};

const ALL_SPEAKERS = "";

/** The segment being spoken at `playhead`: the last one that started at or before it. */
function activeIndex(segments: TSegment[], playhead: number | null) {
  if (playhead === null) return -1;
  let index = -1;
  segments.forEach((segment, position) => {
    if (segment.start !== null && segment.start <= playhead) index = position;
  });
  return index;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return text;
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  for (let at = lower.indexOf(query); at !== -1; at = lower.indexOf(query, at + query.length)) {
    parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className="rounded-xs bg-warning-subtle px-0.5 text-primary">
        {text.slice(at, at + query.length)}
      </mark>
    );
    from = at + query.length;
  }
  parts.push(text.slice(from));
  return parts;
}

export function MeetingTranscript({ segments, onSeek, playhead }: Props) {
  const [search, setSearch] = useState("");
  const [speaker, setSpeaker] = useState(ALL_SPEAKERS);
  const query = search.trim().toLowerCase();
  const speakers = useMemo(() => [...new Set(segments.map((segment) => segment.speaker).filter(Boolean))], [segments]);
  const rows = useMemo(
    () =>
      segments
        .map((segment, index) => ({ segment, index }))
        .filter(
          ({ segment }) =>
            (!speaker || segment.speaker === speaker) && (!query || segment.text.toLowerCase().includes(query))
        ),
    [segments, speaker, query]
  );
  const active = activeIndex(segments, playhead);
  const activeRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  if (!segments.length) return null;
  const filtered = Boolean(query || speaker);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <SummonSearchField
          label="Search transcript"
          placeholder="Search transcript"
          value={search}
          onValueChange={setSearch}
          size="base"
          className="min-w-40 flex-1"
        />
        {speakers.length > 1 ? (
          <Select
            value={speaker}
            onValueChange={(value) => setSpeaker(value)}
            aria-label="Filter by speaker"
            className="w-40"
            options={[
              { value: ALL_SPEAKERS, label: "All speakers" },
              ...speakers.map((name) => ({ value: name, label: name })),
            ]}
          />
        ) : null}
      </div>
      {filtered ? (
        <p className="pb-2 text-12 text-tertiary" role="status">
          {rows.length} of {segments.length} lines
        </p>
      ) : null}
      <ol className="space-y-0.5">
        {rows.map(({ segment, index }, position) => {
          // Consecutive turns by one speaker read as one block, as in a chat; filters break the run.
          const previous = rows[position - 1]?.segment;
          // Without speaker labels (a plain recording upload) every line is a continuation with its moment shown.
          const unlabelled = !segment.speaker;
          const continues = unlabelled || Boolean(previous && previous.speaker === segment.speaker && !filtered);
          const isActive = index === active;
          return (
            <li
              key={index}
              ref={isActive ? activeRef : undefined}
              aria-current={isActive ? "true" : undefined}
              className={`group grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2 rounded-lg px-2 transition-colors ${
                continues ? "pt-0.5 pb-1.5" : "pt-2.5 pb-1.5"
              } ${isActive ? "bg-accent-subtle" : ""}`}
            >
              {continues ? (
                // A continued turn keeps its own moment in the gutter, revealed on hover or keyboard focus.
                <div
                  className={`text-right transition-opacity ${
                    unlabelled ? "" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                  }`}
                >
                  {segment.start !== null ? <TimestampButton seconds={segment.start} onSeek={onSeek} /> : null}
                </div>
              ) : (
                <div className="flex justify-end pt-0.5">
                  <SpeakerAvatar name={segment.speaker} />
                </div>
              )}
              <div className="min-w-0">
                {continues ? null : (
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-12 font-semibold text-primary">{segment.speaker || "Speaker"}</span>
                    {segment.start !== null ? <TimestampButton seconds={segment.start} onSeek={onSeek} /> : null}
                  </div>
                )}
                <p className="text-13 leading-5 text-secondary">
                  <Highlighted text={segment.text} query={query} />
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {filtered && !rows.length ? <p className="py-6 text-center text-12 text-tertiary">No matching lines.</p> : null}
    </div>
  );
}
