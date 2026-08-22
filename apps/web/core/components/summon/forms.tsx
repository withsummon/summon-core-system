/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";

export function SummonField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-xs flex min-w-0 flex-col gap-1 font-medium text-secondary">
      {label}
      {children}
    </label>
  );
}

export function SummonSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`text-sm rounded-md border border-subtle bg-layer-2 px-3 py-2 text-primary outline-none focus:border-accent-strong ${props.className ?? ""}`}
    />
  );
}
