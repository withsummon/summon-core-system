/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ColumnDef, Row } from "@tanstack/react-table";
import { csvDownload } from "@plane/utils";

export const exportCSV = <T>(rows: Row<T>[], columns: ColumnDef<T>[], workspaceSlug: string) => {
  const exportColumns = columns.flatMap((column) => (column.meta?.export ? [column.meta.export] : []));
  csvDownload(
    [
      exportColumns.map((column) => column.label ?? column.key),
      ...rows.map((row) => exportColumns.map((column) => String(column.value(row)))),
    ],
    `${workspaceSlug}-analytics`,
    { formulaProtection: "text" }
  );
};
