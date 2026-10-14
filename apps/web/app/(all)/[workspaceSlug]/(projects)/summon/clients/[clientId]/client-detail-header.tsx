/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { ChevronDown, ChevronRight, CircleEllipsis, Pencil, Plus } from "lucide-react";
import type { ISummonClientDetail } from "@plane/types";
import { capitalizeFirstLetter, replaceUnderscoreIfSnakeCase } from "@plane/utils";
import { opportunityCreateHref } from "@/components/summon/opportunities/delivery-handoff";
import { formatSummonDate } from "@/components/summon/date";

export function ClientDetailHeader(props: {
  workspaceSlug: string;
  data: ISummonClientDetail;
  canCreateOpportunity: boolean;
  onEdit: () => void;
}) {
  const { workspaceSlug, data, canCreateOpportunity, onEdit } = props;
  return (
    <>
      <div className="flex items-center gap-2 text-12 text-secondary">
        <Link href={`/${workspaceSlug}/summon/clients/`} className="hover:text-primary">
          Clients
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-medium text-primary">{data.name}</span>
      </div>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="grid size-24 shrink-0 place-items-center rounded-2xl border border-subtle bg-surface-1 text-2xl font-semibold text-accent-primary shadow-sm">
            {data.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-primary">{data.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-12 text-secondary">
              <span className="rounded-full bg-success-subtle px-2.5 py-1 font-medium text-success-primary">
                {capitalizeFirstLetter(replaceUnderscoreIfSnakeCase(data.status))} Client
              </span>
              <span>•</span>
              <span>Since {formatSummonDate(data.relationship_started_at)}</span>
              <span>•</span>
              <span>{data.industry || "Industry not set"}</span>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-secondary">
              {data.notes || "No client relationship notes yet."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl border border-subtle bg-surface-1 text-secondary"
            aria-label="More client actions"
          >
            <CircleEllipsis className="size-4" />
          </button>
          {canCreateOpportunity ? (
            <Link
              href={opportunityCreateHref(workspaceSlug, data.id)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-subtle bg-surface-1 px-4 text-xs font-medium text-primary hover:bg-layer-1"
            >
              <Plus className="size-3.5" /> New opportunity
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent-primary px-5 text-xs font-medium text-white"
          >
            <Pencil className="size-3.5" /> Edit Client
          </button>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl bg-accent-primary text-white"
            aria-label="Open client actions"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
      </header>
    </>
  );
}
