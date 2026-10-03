/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useOutletContext } from "react-router";
import type { WorkspaceDraftSession } from "./layout";
import { PageHead } from "@/components/core/page-title";
import { WorkspaceDraftIssuesRoot } from "@/components/issues/workspace-draft";

export default function WorkspaceDraftPage() {
  const session = useOutletContext<WorkspaceDraftSession>();
  return (
    <>
      <PageHead title="Workspace Draft" />
      <div className="relative h-full w-full overflow-hidden overflow-y-auto">
        <WorkspaceDraftIssuesRoot session={session} />
      </div>
    </>
  );
}
