/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useSearchParams } from "react-router";
import { ModuleDirectory } from "@/components/convex-core/modules/directory";
export default function ProjectModulesPage() {
  const [params] = useSearchParams();
  return <ModuleDirectory view={params.get("moduleView") === "trash" ? "trash" : "active"} />;
}
