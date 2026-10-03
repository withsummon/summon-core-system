/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { CollapsiblePrimitive } from "@plane/propel/collapsible";
import { useOutsideClickDetector } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { getIconButtonStyling } from "@plane/propel/icon-button";
import { IconButton } from "@plane/propel/icon-button";
import { EditIcon, ChevronDownIcon, CloseIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import { Loader } from "@plane/ui";
import { cn, renderFormattedDate } from "@plane/utils";
import { CoverImage } from "@/components/common/cover-image";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { usePlatformOS } from "@/hooks/use-platform-os";
import type { ProfileSummary } from "./overview/stats";
import { ProfileSidebarTime } from "./time";

const projectMetrics = [
  { key: "createdCount", label: "Created", color: "#203b80" },
  { key: "assignedCount", label: "Assigned", color: "#3f76ff" },
  { key: "pendingCount", label: "Pending", color: "#f59e0b" },
  { key: "completedByTimestamp", label: "Completed", color: "#16a34a" },
] as const;

export function ProfileSidebar({
  subject,
  summary,
  collapsed,
  onClose,
  className,
}: {
  subject: FunctionReturnType<typeof api.tasks.profile.subject>;
  summary: ProfileSummary;
  collapsed: boolean;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();
  useOutsideClickDetector(ref, onClose);

  return (
    <aside
      ref={ref}
      id="profile-details"
      aria-label="Profile details"
      className={cn(
        "vertical-scrollbar fixed z-5 scrollbar-md h-full w-full shrink-0 overflow-hidden overflow-y-auto border-l border-subtle bg-surface-1 shadow-raised-200 transition-all md:relative md:block md:w-[300px]",
        collapsed ? "hidden" : "block",
        className
      )}
    >
      <div className="relative h-[110px]">
        <IconButton
          icon={CloseIcon}
          variant="secondary"
          aria-label="Close profile details"
          className="absolute top-3.5 left-3.5 z-1 md:hidden"
          onClick={onClose}
        />
        {subject.canEditProfile && (
          <Link
            href="/settings/profile/general"
            aria-label={t("profile_settings")}
            className={cn("absolute top-3.5 right-3.5 z-1", getIconButtonStyling("secondary", "base"))}
          >
            <EditIcon className="size-4" />
          </Link>
        )}
        {subject.cover ? (
          <AuthenticatedAssetImage
            asset={subject.cover}
            alt="Profile cover"
            className="h-[110px] w-full object-cover"
          />
        ) : (
          <CoverImage
            src={subject.externalCoverUrl}
            alt="Profile cover"
            className="h-[110px] w-full"
            showDefaultWhenEmpty
          />
        )}
        <div className="absolute -bottom-[26px] left-5 h-[52px] w-[52px] rounded-sm">
          {subject.avatar ? (
            <AuthenticatedAssetImage
              asset={subject.avatar}
              alt="Profile avatar"
              className="h-full w-full rounded-sm object-cover"
            />
          ) : (
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-sm bg-accent-primary text-on-color capitalize">
              {subject.firstName[0]}
            </div>
          )}
        </div>
      </div>
      <div className="px-5">
        <div className="mt-[38px]">
          <h4 className="text-16 font-semibold">
            {subject.firstName} {subject.lastName}
          </h4>
          <h6 className="text-13 text-secondary">({subject.displayName})</h6>
        </div>
        <div className="mt-6 space-y-5">
          <div className="flex items-center gap-4 text-13">
            <div className="w-2/5 shrink-0 text-secondary">{t("profile.details.joined_on")}</div>
            <div className="w-3/5 font-medium break-words">
              {renderFormattedDate(new Date(subject.accountCreatedAt))}
            </div>
          </div>
          <div className="flex items-center gap-4 text-13">
            <div className="w-2/5 shrink-0 text-secondary">{t("profile.details.time_zone")}</div>
            <div className="w-3/5 font-medium break-words">
              <ProfileSidebarTime timeZone={subject.timezone} />
            </div>
          </div>
        </div>
        {subject.canViewTaskTabs && (
          <div className="mt-9 divide-y divide-subtle">
            {summary.status === "Exhausted" ? (
              summary.results.map((project, index) => {
                const total = projectMetrics.reduce((count, metric) => count + project[metric.key], 0);
                const completion =
                  project.assignedCount === 0
                    ? 0
                    : Math.round((project.completedByTimestamp / project.assignedCount) * 100);
                return (
                  <CollapsiblePrimitive.Root key={project.projectId} className={index === 0 ? "pb-3" : "py-3"}>
                    <CollapsiblePrimitive.Trigger className="flex w-full items-center justify-between gap-2">
                      <div className="flex w-3/4 items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center">
                          <Logo logo={project.logo ?? undefined} />
                        </span>
                        <div className="truncate text-13 font-medium break-words">{project.name}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {project.assignedCount > 0 && (
                          <Tooltip tooltipContent="Completion percentage" position="left" isMobile={isMobile}>
                            <span
                              className={cn(
                                "rounded-sm px-1 py-0.5 text-11 font-medium",
                                completion <= 35
                                  ? "bg-danger-subtle text-danger-primary"
                                  : completion <= 70
                                    ? "bg-yellow-500/10 text-yellow-500"
                                    : "bg-success-subtle text-success-primary"
                              )}
                            >
                              {completion}%
                            </span>
                          </Tooltip>
                        )}
                        <ChevronDownIcon className="h-4 w-4" aria-hidden />
                      </div>
                    </CollapsiblePrimitive.Trigger>
                    <CollapsiblePrimitive.Panel className="mt-5 pl-9">
                      {total > 0 && (
                        <div className="flex items-center gap-0.5" aria-hidden>
                          {projectMetrics.map((metric) => (
                            <div
                              key={metric.key}
                              className="h-1 rounded-sm"
                              style={{
                                backgroundColor: metric.color,
                                width: `${(project[metric.key] / total) * 100}%`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                      <dl className="mt-7 space-y-5 text-13 text-secondary">
                        {projectMetrics.map((metric) => (
                          <div key={metric.key} className="flex items-center justify-between gap-2">
                            <dt className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-xs"
                                style={{ backgroundColor: metric.color }}
                                aria-hidden
                              />
                              {metric.label}
                            </dt>
                            <dd className="font-medium">
                              {project[metric.key]} {t("issues")}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </CollapsiblePrimitive.Panel>
                  </CollapsiblePrimitive.Root>
                );
              })
            ) : (
              <Loader className="space-y-5">
                <span className="sr-only">{t("loading")}</span>
                <Loader.Item height="28px" />
                <Loader.Item height="28px" />
                <Loader.Item height="28px" />
              </Loader>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
