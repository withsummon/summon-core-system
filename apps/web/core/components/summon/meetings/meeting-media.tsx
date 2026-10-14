/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Avatar } from "@plane/propel/avatar";

/** Jumps the recording to a moment; undefined when the meeting has nowhere to play it. */
export type TSeek = ((seconds: number) => void) | undefined;

/** 217 → "03:37", 3725 → "1:02:05". */
export function formatClock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = String(whole % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${String(minutes).padStart(2, "0")}:${secs}`;
}

/** A moment in the meeting. It plays from there when there is a recording, and reads as plain text otherwise. */
export function TimestampButton({ seconds, onSeek }: { seconds: number; onSeek: TSeek }) {
  const label = formatClock(seconds);
  if (!onSeek) return <span className="font-mono text-11 text-tertiary tabular-nums">{label}</span>;
  return (
    <button
      type="button"
      onClick={() => onSeek(seconds)}
      aria-label={`Play from ${label}`}
      className="rounded-sm px-1 font-mono text-11 font-medium text-accent-primary tabular-nums hover:bg-accent-subtle focus-visible:outline-2 focus-visible:outline-accent-strong"
    >
      {label}
    </button>
  );
}

// Mid-tone hues that hold white initials in both themes; a speaker keeps one colour across the page.
const SPEAKER_COLORS = ["#5B6BD5", "#2F8F83", "#C0671F", "#A8488A", "#3B82C4", "#7457C9", "#4F8A3A", "#BF4B4B"];

export function speakerColor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length];
}

export function SpeakerAvatar({ name, size = "base" }: { name: string; size?: "md" | "base" }) {
  return (
    <Avatar
      name={name || "Speaker"}
      size={size}
      fallbackBackgroundColor={speakerColor(name || "Speaker")}
      fallbackTextColor="#ffffff"
      showTooltip={false}
    />
  );
}
