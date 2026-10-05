/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { redirect } from "react-router";
// plane imports
import { api } from "@summon/convex/api";
import { convex } from "@/app/providers";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
import type { Route } from "./+types/page";

export const clientLoader = async ({ params, request }: Route.ClientLoaderArgs) => {
  const { workspaceSlug, projectId } = params;

  // Validate required params
  if (!workspaceSlug || !projectId) {
    throw redirect("/404");
  }

  // Extract query params from the request URL
  const url = new URL(request.url);
  const board = url.searchParams.get("board");
  const peekId = url.searchParams.get("peekId");

  if (!convex) throw redirect("/404");
  let anchor: string;
  try {
    ({ anchor } = await convex.query(api.publicSharing.index.resolveProject, { workspaceSlug, projectId }));
  } catch {
    throw redirect("/404");
  }
  const urlParams = new URLSearchParams();
  if (board) urlParams.set("board", board);
  if (peekId) urlParams.set("peekId", peekId);
  throw redirect(`/issues/${anchor}${urlParams.size ? `?${urlParams}` : ""}`);
};

export default function IssuesPage() {
  return (
    <div className="flex h-screen min-h-[500px] w-full items-center justify-center">
      <LogoSpinner />
    </div>
  );
}
