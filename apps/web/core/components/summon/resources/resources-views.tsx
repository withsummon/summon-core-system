/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import { Menu } from "@plane/propel/menu";
import type { ISummonResourceLink } from "@plane/types";
import { ResourceBadge } from "./resource-badge";
import { ResourceIcon } from "./resource-icon";

type TProjectOption = { id: string; name: string };

/** Column labels: the desktop header and the phone row label read from the same entry. */
const RESOURCE_COLUMNS = {
  name: "Name",
  project: "Project",
  type: "Type",
  lastUpdated: "Last updated",
  updatedBy: "Updated by",
} as const;

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
    if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
    return SHORT_DATE_FORMATTER.format(date);
  } catch {
    return "Recently";
  }
}

export function projectNameOf(item: ISummonResourceLink, projects: { id: string; name: string }[]) {
  return item.project_detail?.name || projects.find((p) => p.id === item.project)?.name || "Global Resource";
}

/** Relative "last updated" labels, computed once per resource list rather than on every render. */
const useUpdatedLabels = (resources: ISummonResourceLink[]) =>
  useMemo(() => new Map(resources.map((item) => [item.id, formatRelativeTime(item.updated_at)])), [resources]);

type TResourcesTableProps = {
  resources: ISummonResourceLink[];
  projectsList: TProjectOption[];
  onCopyUrl: (url: string) => void;
  onDelete: (id: string) => void;
};

export function ResourcesTable({ resources, projectsList, onCopyUrl, onDelete }: TResourcesTableProps) {
  const updatedLabels = useUpdatedLabels(resources);
  return (
    <div className="overflow-x-auto">
      <table className="table-stack w-full text-left text-13">
        <thead>
          <tr className="border-b border-subtle text-12 whitespace-nowrap text-tertiary">
            <th className="px-3.5 py-2 font-medium">{RESOURCE_COLUMNS.name}</th>
            <th className="px-3.5 py-2 font-medium">{RESOURCE_COLUMNS.project}</th>
            <th className="px-3.5 py-2 font-medium">{RESOURCE_COLUMNS.type}</th>
            <th className="px-3.5 py-2 font-medium">{RESOURCE_COLUMNS.lastUpdated}</th>
            <th className="px-3.5 py-2 font-medium">{RESOURCE_COLUMNS.updatedBy}</th>
            <th className="px-3.5 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle">
          {resources.length > 0 ? (
            resources.map((item) => {
              const projectName = projectNameOf(item, projectsList);
              const updatedBy =
                item.updated_by_detail?.display_name || item.created_by_detail?.display_name || "Summon User";

              return (
                <tr key={item.id} className="transition-colors hover:bg-layer-1 max-md:relative">
                  <td className="w-full px-3.5 py-2.5 max-md:pr-10 md:max-w-0 md:min-w-48">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 items-center gap-2.5 font-medium text-primary hover:text-accent-primary"
                    >
                      <ResourceIcon category={item.category} title={item.title} url={item.url} className="size-4" />
                      <span className="truncate" title={item.title}>
                        {item.title}
                      </span>
                    </a>
                  </td>
                  <td data-label={RESOURCE_COLUMNS.project} className="truncate px-3.5 py-2.5 text-secondary md:max-w-36">
                    {projectName}
                  </td>
                  <td data-label={RESOURCE_COLUMNS.type} className="px-3.5 py-2.5">
                    <ResourceBadge category={item.category} />
                  </td>
                  <td data-label={RESOURCE_COLUMNS.lastUpdated} className="px-3.5 py-2.5 whitespace-nowrap text-secondary">
                    {updatedLabels.get(item.id)}
                  </td>
                  <td data-label={RESOURCE_COLUMNS.updatedBy} className="px-3.5 py-2.5">
                    <span className="flex items-center gap-2 whitespace-nowrap text-primary">
                      <span
                        aria-hidden="true"
                        className="grid size-6 place-items-center rounded-full bg-layer-2 text-12 font-medium"
                      >
                        {updatedBy.charAt(0).toUpperCase()}
                      </span>
                      <span className="max-w-[120px] truncate">{updatedBy}</span>
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right max-md:absolute max-md:top-2 max-md:right-2 max-md:p-0!">
                    <Menu ellipsis placement="bottom-end" ariaLabel={`Actions for ${item.title}`}>
                      <Menu.MenuItem onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}>
                        <ExternalLink aria-hidden="true" className="size-3.5 text-secondary" />
                        Open link
                      </Menu.MenuItem>
                      <Menu.MenuItem onClick={() => onCopyUrl(item.url)}>
                        <Copy aria-hidden="true" className="size-3.5 text-secondary" />
                        Copy URL
                      </Menu.MenuItem>
                      <Menu.MenuItem className="text-danger-primary" onClick={() => onDelete(item.id)}>
                        <Trash2 aria-hidden="true" className="size-3.5" />
                        Delete
                      </Menu.MenuItem>
                    </Menu>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={6} className="px-3.5 py-8 text-center text-12 text-tertiary">
                Loading resources…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

type TResourcesGridProps = {
  resources: ISummonResourceLink[];
  projectsList: TProjectOption[];
};

export function ResourcesGrid({ resources, projectsList }: TResourcesGridProps) {
  const updatedLabels = useUpdatedLabels(resources);
  return (
    <div className="grid grid-cols-1 gap-3 p-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {resources.map((item) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="group flex flex-col justify-between rounded-lg border border-subtle bg-layer-1 p-3.5 transition-colors hover:border-strong"
        >
          <div>
            <div className="flex items-start justify-between gap-2">
              <ResourceIcon category={item.category} title={item.title} url={item.url} className="size-4" />
              <ResourceBadge category={item.category} />
            </div>
            <h3 className="mt-3 line-clamp-2 text-13 font-medium text-primary group-hover:text-accent-primary">
              {item.title}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-12 text-tertiary">{projectNameOf(item, projectsList)}</p>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-subtle pt-2 text-12 text-tertiary">
            <span>{updatedLabels.get(item.id)}</span>
            <ExternalLink aria-hidden="true" className="size-3 text-secondary" />
          </div>
        </a>
      ))}
    </div>
  );
}
