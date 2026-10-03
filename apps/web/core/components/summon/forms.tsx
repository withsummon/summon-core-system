/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";

export function SummonFilterRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function SummonField({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  if (htmlFor)
    return (
      <div className="flex min-w-0 flex-col gap-1.5 text-12 font-medium text-secondary">
        <label htmlFor={htmlFor}>{label}</label>
        {children}
      </div>
    );
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-12 font-medium text-secondary">
      {label}
      {children}
    </label>
  );
}
