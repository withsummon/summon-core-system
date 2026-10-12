/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { Compass } from "lucide-react";
// ui
import { getButtonStyling } from "@plane/propel/button";
// types
import type { Route } from "./+types/not-found";

export const meta: Route.MetaFunction = () => [
  { title: "404 - Page Not Found" },
  { name: "robots", content: "noindex, nofollow" },
];

function PageNotFound() {
  return (
    <div className="grid h-screen w-full place-items-center bg-dot-grid p-4">
      <div className="flex max-w-sm flex-col items-center text-center">
        <span className="grid size-10 place-items-center rounded-xl bg-surface-1 text-tertiary shadow-raised-100 ring ring-subtle">
          <Compass aria-hidden className="size-5" />
        </span>
        <h1 className="mt-4 text-16 font-semibold text-primary">Page not found</h1>
        <p className="mt-1 text-13 text-secondary">This page was moved, renamed or never existed.</p>
        <Link href="/" className={`${getButtonStyling("primary", "lg")} mt-5`}>
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export default PageNotFound;
