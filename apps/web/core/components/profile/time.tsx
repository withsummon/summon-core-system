/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { useCurrentTime } from "@/hooks/use-current-time";

export function ProfileSidebarTime({
  timeZone,
}: {
  timeZone: FunctionReturnType<typeof api.tasks.profile.subject>["timezone"];
}) {
  const { currentTime } = useCurrentTime();
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(currentTime);
  return (
    <span>
      {time} <span className="text-secondary">{timeZone}</span>
    </span>
  );
}
