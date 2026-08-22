/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { Button, Input } from "@plane/ui";
import Link from "next/link";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonMetric, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import { listAccessiblePlanePages } from "@/services/summon-plane.service";
import type { Route } from "./+types/page";

export default function SummonResourcesPage({ params }: Route.ComponentProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("repository");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("all");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const { data, error, isLoading, mutate } = useSWR(["summon-resources", params.workspaceSlug], async () => {
    const [resources, pages] = await Promise.all([
      summonService.listResources(params.workspaceSlug),
      listAccessiblePlanePages(params.workspaceSlug),
    ]);
    return { resources, pages };
  });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await summonService.createResource(params.workspaceSlug, { title, url, category });
      setTitle("");
      setUrl("");
      await mutate();
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };
  const resources = data?.resources ?? [];
  const pageTargets = new Map((data?.pages ?? []).map(({ page, project: pageProject }) => [page.id, pageProject]));
  const projects = [
    ...new Map((data?.pages ?? []).map(({ project: pageProject }) => [pageProject.id, pageProject])).values(),
  ];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredResources = resources.filter(
    (item) =>
      (project === "all" || item.project === project) &&
      `${item.title} ${item.url} ${item.category}`.toLowerCase().includes(normalizedQuery)
  );

  return (
    <SummonScreen
      title="Resources"
      description="External URLs live here once. Uploaded documents stay in Plane FileAsset and Pages."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummonMetric label="All resources" value={resources.length} detail="External references" />
        <SummonMetric
          label="Categories"
          value={new Set(resources.map((item) => item.category)).size}
          detail="Resource types"
        />
        <SummonMetric
          label="Linked projects"
          value={new Set(resources.map(({ project: resourceProject }) => resourceProject).filter(Boolean)).size}
          detail="Plane relationships"
        />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          <SummonCard>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                aria-label="Search resources"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search resources"
              />
              <select
                aria-label="Filter resources by project"
                value={project}
                onChange={(event) => setProject(event.target.value)}
                className="text-sm h-9 rounded-lg border border-subtle bg-layer-1 px-3 text-primary"
              >
                <option value="all">All projects</option>
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </SummonCard>
          <SummonRequestState
            loading={isLoading}
            error={error}
            empty={!isLoading && filteredResources.length === 0}
            emptyMessage={resources.length ? "No resources match these filters." : "No resources yet."}
            onRetry={() => void mutate()}
          />
          {filteredResources.length ? (
            <div className="shadow-sm divide-y divide-subtle overflow-hidden rounded-xl border border-subtle bg-surface-1">
              {filteredResources.map((item) => {
                const pageProject = item.page ? pageTargets.get(item.page) : undefined;
                const href =
                  item.page && pageProject
                    ? `/${params.workspaceSlug}/projects/${pageProject.id}/pages/${item.page}/`
                    : item.url;
                const content = (
                  <>
                    <div className="min-w-0">
                      <p className="text-sm truncate font-medium text-primary">{item.title}</p>
                      <p className="text-xs mt-1 truncate text-secondary">{item.page ? "Plane Page" : item.url}</p>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-layer-2 px-2 py-1 text-[11px] text-secondary">
                      {item.category}
                    </span>
                  </>
                );
                return item.page && pageProject ? (
                  <Link
                    key={item.id}
                    href={href}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-layer-1"
                  >
                    {content}
                  </Link>
                ) : (
                  <a
                    key={item.id}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-layer-1"
                  >
                    {content}
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>
        <SummonCard>
          <h2 className="text-sm font-semibold text-primary">Add resource</h2>
          <p className="text-xs mt-1 text-secondary">
            Keep one canonical external link; upload files through native Plane Pages.
          </p>
          <form onSubmit={submit} className="mt-4 grid gap-3">
            <SummonField label="Title">
              <Input required value={title} onChange={(event) => setTitle(event.target.value)} />
            </SummonField>
            <SummonField label="External URL">
              <Input
                required
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://"
              />
            </SummonField>
            <SummonField label="Type">
              <SummonSelect value={category} onChange={(event) => setCategory(event.target.value)}>
                {["repository", "figma", "deployment", "drive", "recording", "account"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </SummonSelect>
            </SummonField>
            <Button type="submit" loading={saving}>
              Add resource
            </Button>
            {formError ? <p className="text-xs text-danger-primary">{formError}</p> : null}
          </form>
        </SummonCard>
      </div>
    </SummonScreen>
  );
}
