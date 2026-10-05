/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const renderEmoji = (
  emoji:
    | string
    | {
        name: string;
        color: string;
      }
) => {
  if (!emoji) return;

  if (typeof emoji === "object")
    return (
      <span style={{ color: emoji.color }} className="material-symbols-rounded text-16">
        {emoji.name}
      </span>
    );
  else return isNaN(parseInt(emoji)) ? emoji : String.fromCodePoint(parseInt(emoji));
};

export function groupReactions<T extends { reaction: string }>(reactions: T[]) {
  const groups = new Map<string, T[]>();
  for (const reaction of reactions) {
    const group = groups.get(reaction.reaction);
    if (group) group.push(reaction);
    else groups.set(reaction.reaction, [reaction]);
  }
  return groups;
}
