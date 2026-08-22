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
import { listAccessiblePlanePages } from "@/services/summon-plane.service";
import type { Route } from "./+types/page";

export default function SummonDocumentsPage({ params }: Route.ComponentProps) {
  const [query, setQuery] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-plane-pages", params.workspaceSlug], () =>
    listAccessiblePlanePages(params.workspaceSlug)
  );
  const normalizedQuery = query.trim().toLowerCase();
  const pages = (data ?? []).filter(({ page, project }) =>
    `${page.name ?? ""} ${project.name}`.toLowerCase().includes(normalizedQuery)
  );

  return (
    <SummonScreen
      title="Documents"
      description="Authorized Plane Pages are indexed here. Open Plane to edit pages or upload native FileAssets."
    >
      <SummonCard>
        <Input
          aria-label="Search documents"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search documents"
        />
      </SummonCard>
      <SummonRequestState
        loading={isLoading}
        error={error}
        empty={!isLoading && pages.length === 0}
        emptyMessage={data?.length ? "No documents match this search." : "No accessible Plane Pages yet."}
        onRetry={() => void mutate()}
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {pages.map(({ page, project }) => (
          <Link
            key={page.id}
            href={`/${params.workspaceSlug}/projects/${project.id}/pages/${page.id}/`}
            className="rounded-2xl border border-subtle bg-surface-1 p-4 shadow-[0_8px_30px_rgba(36,55,99,0.035)] hover:bg-layer-1 focus-visible:outline focus-visible:outline-2"
          >
            <p className="text-sm font-semibold text-primary">{page.name || "Untitled Page"}</p>
            <p className="text-xs mt-1 text-secondary">
              {project.identifier} · {project.name}
            </p>
            <p className="mt-4 text-[10px] text-accent-primary">Open in Plane →</p>
          </Link>
        ))}
      </div>
    </SummonScreen>
  );
}
