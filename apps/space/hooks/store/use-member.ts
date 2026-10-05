/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { useParams } from "react-router";
import { usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";

export function useMember() {
  const { anchor } = useParams();
  const directory = usePaginatedQuery(api.publicSharing.index.members, anchor ? { anchor } : "skip", {
    initialNumItems: 50,
  });
  const { status, loadMore } = directory;
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(50);
  }, [status, loadMore]);
  return directory;
}
