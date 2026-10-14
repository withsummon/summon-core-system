/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Avatar } from "@plane/propel/avatar";
import { generateRandomColor, hslToHex } from "@plane/utils";

/** Jumps the recording to a moment; undefined when the meeting has nowhere to play it. */
export type TSeek = ((seconds: number) => void) | undefined;

/** 217 → "03:37", 3725 → "1:02:05". */
function formatClock(seconds: number) {
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

export function SpeakerAvatar({ name, size = "base" }: { name: string; size?: "md" | "base" }) {
  return (
    <Avatar
      name={name || "Speaker"}
      size={size}
      // A speaker keeps one pastel colour across the page; pastels need dark initials.
      fallbackBackgroundColor={hslToHex(generateRandomColor(name || "Speaker"))}
      fallbackTextColor="#1f2328"
      showTooltip={false}
    />
  );
}
