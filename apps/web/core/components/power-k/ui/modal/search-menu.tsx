/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import { WORKSPACE_DEFAULT_SEARCH_RESULT } from "@plane/constants";
import { cn } from "@plane/utils";
// hooks
import { usePowerK } from "@/hooks/store/use-power-k";
import useDebounce from "@/hooks/use-debounce";
import { WorkspaceService } from "@/services/workspace.service";
// local imports
import type { TPowerKContext, TPowerKPageType } from "../../core/types";
import { narrowSearchResults } from "./narrow-search-results";
import type { TSearchResponse } from "./narrow-search-results";
import { PowerKModalNoSearchResultsCommand } from "./no-results-command";
import { PowerKModalSearchResults } from "./search-results";
// services init
const workspaceService = new WorkspaceService();

// Just long enough to skip requests mid-word; the server answers in tens of milliseconds.
const SEARCH_DEBOUNCE_MS = 100;

type Props = {
  activePage: TPowerKPageType | null;
  context: TPowerKContext;
  isWorkspaceLevel: boolean;
  searchTerm: string;
  updateSearchTerm: (value: string) => void;
  handleSearchMenuClose?: () => void;
};

export function PowerKModalSearchMenu(props: Props) {
  const { activePage, context, isWorkspaceLevel, searchTerm, updateSearchTerm, handleSearchMenuClose } = props;
  const term = searchTerm.trim();
  const debouncedTerm = useDebounce(term, SEARCH_DEBOUNCE_MS);
  // navigation
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { togglePowerKModal } = usePowerK();
  // Keyed by term, so a late response can never overwrite a newer one and revisited terms are instant.
  const { data, isValidating } = useSWR(
    !activePage && workspaceSlug && debouncedTerm
      ? ["power-k-search", workspaceSlug.toString(), projectId?.toString(), isWorkspaceLevel, debouncedTerm]
      : null,
    async ([, slug, project, workspaceLevel, search]): Promise<TSearchResponse> => ({
      term: search,
      results: await workspaceService.searchWorkspace(slug, {
        ...(project ? { project_id: project } : {}),
        search,
        workspace_search: !project ? true : workspaceLevel,
      }),
    }),
    { keepPreviousData: true, revalidateOnFocus: false, revalidateIfStale: false, shouldRetryOnError: false }
  );

  const results = data && term ? narrowSearchResults(data, term) : WORKSPACE_DEFAULT_SEARCH_RESULT;
  const resultsCount = Object.values(results.results).reduce((count, section) => count + section.length, 0);
  const isSettled = !isValidating && data?.term === term;

  if (activePage) return null;

  const handleClosePalette = () => {
    handleSearchMenuClose?.();
    togglePowerKModal(false);
  };

  return (
    <>
      {searchTerm.trim() !== "" && (
        <div className="mt-4 flex items-center justify-between gap-2 px-4">
          <h5
            className={cn("text-11 text-primary", {
              "animate-pulse": !isSettled,
            })}
          >
            Search results for{" "}
            <span className="font-medium">
              {'"'}
              {searchTerm}
              {'"'}
            </span>{" "}
            in {isWorkspaceLevel ? "workspace" : "project"}:
          </h5>
        </div>
      )}

      {/* Show empty state only when not loading and no results */}
      {isSettled && resultsCount === 0 && (
        <PowerKModalNoSearchResultsCommand
          context={context}
          searchTerm={searchTerm}
          updateSearchTerm={updateSearchTerm}
        />
      )}

      {searchTerm.trim() !== "" && <PowerKModalSearchResults closePalette={handleClosePalette} results={results} />}
    </>
  );
}
