/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CheckCircle2 } from "lucide-react";

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
