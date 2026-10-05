/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Loader } from "@plane/ui";
export default function InsightCard({
  count,
  label,
  isLoading = false,
}: {
  count?: number;
  label: string;
  isLoading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-13 text-tertiary">{label}</div>
      {isLoading ? (
        <Loader.Item height="50px" width="100%" />
      ) : (
        <div className="text-20 font-bold text-primary">{count ?? 0}</div>
      )}
    </div>
  );
}
