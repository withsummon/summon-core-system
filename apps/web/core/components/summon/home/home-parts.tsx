/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import type { CompactAssetType } from "@plane/propel/empty-state";

export function HomeListSection(props: {
  title: string;
  href: string;
  action: string;
  empty: string;
  emptyAsset: CompactAssetType;
  /** Rows shaped like `children`, shown instead of them while the feed loads. */
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(props.children) ? props.children.length > 0 : !!props.children;
  return (
    <section className="mt-6">
      <div className="mb-1 flex items-center justify-between gap-3 px-2">
        <h2 className="text-12 font-medium text-tertiary">{props.title}</h2>
        <Link
          href={props.href}
          className="inline-flex items-center gap-0.5 text-12 font-medium text-tertiary hover:text-primary"
        >
          {props.action} <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <div className="flex flex-col">
        {props.skeleton ?? (
          <>
            {props.children}
            {!hasChildren && <EmptyLine asset={props.emptyAsset} text={props.empty} />}
          </>
        )}
      </div>
    </section>
  );
}

export function PreviewCard(props: { title: string; href?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs ${props.className || ""}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-13 font-semibold text-primary">{props.title}</h3>
        {props.href && (
          <Link
            href={props.href}
            className="inline-flex items-center gap-0.5 text-12 font-medium text-tertiary hover:text-primary"
          >
            See all <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>
      {props.children}
    </section>
  );
}

export function ProjectMark({ identifier, size = "md" }: { identifier: string; size?: "md" | "lg" }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full border border-accent-subtle bg-accent-subtle font-medium text-accent-primary ${size === "lg" ? "size-10 text-14" : "size-7 text-12"}`}
    >
      {identifier.slice(0, 2)}
    </span>
  );
}

export function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-md border border-subtle bg-layer-1 text-tertiary">
      {children}
    </span>
  );
}

export function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-12 text-tertiary">{label}</p>
      <p className="mt-0.5 text-13 font-medium text-primary">{value}</p>
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <dt className="text-13 text-tertiary">{label}</dt>
      <dd className="text-right text-13 font-medium text-primary tabular-nums">{value}</dd>
    </div>
  );
}

export function EmptyLine({ text, asset }: { text: string; asset: CompactAssetType }) {
  return <EmptyStateCompact assetKey={asset} assetClassName="size-20" title={text} rootClassName="py-4" />;
}
