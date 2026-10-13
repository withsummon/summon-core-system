/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CheckCircle2 } from "lucide-react";
import { renderFormattedDate } from "@plane/utils";

// Pass a Date: renderFormattedDate reads strings as date-only, which would drop the local-time conversion.
export const formatDate = (value?: string | null) =>
  (value ? renderFormattedDate(new Date(value)) : undefined) ?? "Not set";

export type TClientTab =
  | "overview"
  | "opportunities"
  | "projects"
  | "contacts"
  | "documents"
  | "activity"
  | "notes"
  | "settings";

export type TPanelLink = { href: string; label: string } | undefined;

export function ClientMetric(props: { icon: React.ReactNode; label: string; value: React.ReactNode; detail: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-subtle p-5 sm:border-r lg:last:border-r-0 sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-primary">
        {props.icon}
      </span>
      <div className="min-w-0">
        <p className="text-12 font-medium text-secondary">{props.label}</p>
        <p className="mt-1.5 truncate text-lg font-semibold text-primary">{props.value}</p>
        <p className="mt-2 truncate text-12 font-medium text-accent-primary">{props.detail} →</p>
      </div>
    </div>
  );
}

export function HealthRow(props: { label: string; detail: string }) {
  return (
    <div className="flex gap-2">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-primary" />
      <div>
        <p className="text-12 font-medium text-primary">{props.label}</p>
        <p className="mt-0.5 text-12 text-secondary">{props.detail}</p>
      </div>
    </div>
  );
}

export function Detail(props: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 text-12">
      <dt className="text-secondary">{props.label}</dt>
      <dd className="font-medium text-primary">{props.value}</dd>
    </div>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-md bg-accent-subtle px-2 py-1 font-medium text-accent-primary">
      {children}
    </span>
  );
}
