/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Copy } from "lucide-react";
import type { Eye } from "lucide-react";
import type { ISummonCredential } from "@plane/types";
import { SummonRequestState } from "@/components/summon/request-state";

export const textMetadata = (credential: ISummonCredential, key: string) => {
  const value = credential.metadata[key];
  return typeof value === "string" && value.trim() ? value : "Not set";
};

export const credentialTags = (credential: ISummonCredential) => {
  const tags = credential.metadata.tags;
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
};

export function Detail({
  label,
  value,
  copy,
  action,
}: {
  label: string;
  value: React.ReactNode;
  copy?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-3">
      <dt className="text-secondary">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 font-medium text-primary">
        <span className="min-w-0 break-words">{value}</span>
        {copy ? <Copy className="size-3.5 flex-none text-tertiary" /> : null}
        {action}
      </dd>
    </div>
  );
}

export function MiniDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-12">
      <dt className="text-secondary">{label}</dt>
      <dd className="text-right font-medium text-primary">{value}</dd>
    </div>
  );
}

export function Action(props: {
  icon: typeof Eye;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`flex items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-layer-1 disabled:cursor-not-allowed disabled:opacity-40 ${props.danger ? "text-danger-primary" : "text-primary"}`}
    >
      <Icon className="size-3.5" />
      {props.label}
    </button>
  );
}

export function PanelList(props: {
  title: string;
  empty: string;
  error?: unknown;
  items: Array<{ id: string; title: string; detail: string }>;
}) {
  if (props.error) return <SummonRequestState error={props.error} />;
  return (
    <div className="rounded-xl border border-subtle">
      <h3 className="border-b border-subtle px-4 py-3 text-sm font-semibold text-primary">{props.title}</h3>
      <div className="divide-y divide-subtle">
        {props.items.map((item) => (
          <div key={item.id} className="px-4 py-3">
            <p className="text-xs font-medium text-primary capitalize">{item.title}</p>
            <p className="mt-1 text-12 text-secondary">{item.detail}</p>
          </div>
        ))}
        {!props.items.length ? <p className="p-4 text-xs text-tertiary">{props.empty}</p> : null}
      </div>
    </div>
  );
}
