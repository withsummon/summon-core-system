/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IWorkspaceSearchResults } from "@plane/types";

export type TSearchResponse = { term: string; results: IWorkspaceSearchResults };

/**
 * While the response for the current term is in flight, keep only the previous term's results that
 * still match, so the list follows every keystroke without showing rows the new term rules out.
 */
export const narrowSearchResults = (response: TSearchResponse, term: string): IWorkspaceSearchResults => {
  if (response.term === term) return response.results;
  const needle = term.toLowerCase();
  const matches = (item: { name: string; project__identifier?: string; sequence_id?: number }) =>
    item.name.toLowerCase().includes(needle) ||
    `${item.project__identifier ?? ""}-${item.sequence_id ?? ""}`.toLowerCase().includes(needle);
  const { results } = response.results;
  return {
    results: {
      workspace: results.workspace.filter(matches),
      project: results.project.filter(matches),
      issue: results.issue.filter(matches),
      cycle: results.cycle.filter(matches),
      module: results.module.filter(matches),
      issue_view: results.issue_view.filter(matches),
      page: results.page.filter(matches),
    },
  };
};
