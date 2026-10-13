/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
// plane types
import { useTranslation } from "@plane/i18n";
import type { IUser } from "@plane/types";
// plane ui
// hooks
import { useCurrentTime } from "@/hooks/use-current-time";

const HOUR_FORMATTER = new Intl.DateTimeFormat("en-US", { hour12: false, hour: "numeric" });
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const timeFormatters = new Map<string, Intl.DateTimeFormat>();
// 24-hour HH:MM in the user's timezone; cached per timezone
const getTimeFormatter = (timeZone: string | undefined) => {
  const cacheKey = timeZone ?? "";
  let formatter = timeFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, hour: "2-digit", minute: "2-digit" });
    timeFormatters.set(cacheKey, formatter);
  }
  return formatter;
};

export interface IUserGreetingsView {
  user: IUser;
}

export function UserGreetingsView(props: IUserGreetingsView) {
  const { user } = props;
  // current time hook
  const { currentTime } = useCurrentTime();
  // store hooks
  const { t } = useTranslation();

  const { hour, date, weekDay, timeString } = useMemo(
    () => ({
      // react-doctor-disable-next-line no-locale-format-in-render -- client-only SPA (react-router ssr: false), never server-rendered
      hour: HOUR_FORMATTER.format(currentTime),
      // react-doctor-disable-next-line no-locale-format-in-render -- client-only SPA (react-router ssr: false), never server-rendered
      date: DATE_FORMATTER.format(currentTime),
      // react-doctor-disable-next-line no-locale-format-in-render -- client-only SPA (react-router ssr: false), never server-rendered
      weekDay: WEEKDAY_FORMATTER.format(currentTime),
      timeString: getTimeFormatter(user?.user_timezone).format(currentTime),
    }),
    [currentTime, user?.user_timezone]
  );

  const greeting = parseInt(hour, 10) < 12 ? "morning" : parseInt(hour, 10) < 18 ? "afternoon" : "evening";

  return (
    <div className="my-6 flex flex-col items-center">
      <h2 className="text-center text-20 font-semibold">
        {t("good")} {t(greeting)}, {user?.first_name} {user?.last_name}
      </h2>
      <h5 className="flex items-center gap-2 font-medium text-placeholder">
        <div>{greeting === "morning" ? "🌤️" : greeting === "afternoon" ? "🌥️" : "🌙️"}</div>
        <div>
          {weekDay}, {date} {timeString}
        </div>
      </h5>
    </div>
  );
}
