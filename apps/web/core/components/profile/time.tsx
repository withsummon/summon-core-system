/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
// hooks
import { useCurrentTime } from "@/hooks/use-current-time";

const timeFormatters = new Map<string, Intl.DateTimeFormat>();
// 24-hour HH:MM in the given timezone; cached per timezone
const getTimeFormatter = (timeZone: string | undefined) => {
  const cacheKey = timeZone ?? "";
  let formatter = timeFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, hour: "2-digit", minute: "2-digit" });
    timeFormatters.set(cacheKey, formatter);
  }
  return formatter;
};

type Props = {
  timeZone: string | undefined;
};

export function ProfileSidebarTime(props: Props) {
  const { timeZone } = props;
  // current time hook
  const { currentTime } = useCurrentTime();

  const timeString = useMemo(() => getTimeFormatter(timeZone).format(currentTime), [currentTime, timeZone]);

  return (
    <span>
      {timeString} <span className="text-secondary">{timeZone}</span>
    </span>
  );
}
