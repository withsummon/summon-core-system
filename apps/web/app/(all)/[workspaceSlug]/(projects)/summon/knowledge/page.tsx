/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useState } from "react";
import { Input } from "@plane/ui";
import Link from "next/link";
import useSWR from "swr";
import { SummonCard, SummonScreen } from "@/components/summon/screen";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonService } from "@/services/summon.service";
import { listAccessiblePlanePages } from "@/services/summon-plane.service";
import type { Route } from "./+types/page";

export default function SummonKnowledgePage({ params }: Route.ComponentProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const { data, error, isLoading, mutate } = useSWR(["summon-knowledge", params.workspaceSlug], async () => {
    const [pages, contexts] = await Promise.all([
      listAccessiblePlanePages(params.workspaceSlug),
      summonService.listPageContexts(params.workspaceSlug),
    ]);
    const pagesById = new Map(pages.map(({ page, project }) => [page.id, { page, project }]));
    return contexts.flatMap((context) => {
      const accessible = pagesById.get(context.page);
      return accessible ? [{ ...accessible, context }] : [];
    });
  });
  const normalizedQuery = query.trim().toLowerCase();
  const categories = [...new Set((data ?? []).map(({ context }) => context.category))];
  const records = (data ?? []).filter(
    ({ page, context }) =>
      (category === "all" || context.category === category) &&
      `${page.name ?? ""} ${context.tags.join(" ")}`.toLowerCase().includes(normalizedQuery)
  );

  return (
    <SummonScreen title="Knowledge" description="Summon context enriches only Plane Pages already authorized for you.">
      <SummonCard>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            aria-label="Search knowledge"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages or tags"
          />
          <select
            aria-label="Filter knowledge category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="text-sm h-9 rounded-lg border border-subtle bg-layer-1 px-3 text-primary"
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </SummonCard>
      <SummonRequestState
        loading={isLoading}
        error={error}
        empty={!isLoading && records.length === 0}
        emptyMessage={data?.length ? "No knowledge matches these filters." : "No authorized knowledge Pages yet."}
        onRetry={() => void mutate()}
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {records.map(({ page, project, context }) => (
          <Link
            key={context.id}
            href={`/${params.workspaceSlug}/projects/${project.id}/pages/${page.id}/`}
            className="rounded-2xl border border-subtle bg-surface-1 p-4 hover:bg-layer-1 focus-visible:outline focus-visible:outline-2"
          >
            <p className="text-sm font-semibold text-primary">{page.name || "Untitled Page"}</p>
            <p className="text-xs mt-1 text-secondary">
              {context.category} · {project.name}
            </p>
            {context.tags.length ? (
              <p className="mt-3 text-[10px] text-accent-primary">{context.tags.join(" · ")}</p>
            ) : null}
          </Link>
        ))}
      </div>
    </SummonScreen>
  );
}
