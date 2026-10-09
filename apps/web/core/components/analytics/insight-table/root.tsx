/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ColumnDef, Row, Table } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { DataTable } from "./data-table";
import { TableLoader } from "./loader";
interface InsightTableProps<T> {
  data?: T[];
  isLoading?: boolean;
  columns: ColumnDef<T>[];
  columnsLabels?: Record<string, string>;
  headerText: string;
  onExport?: (rows: Row<T>[]) => void;
}

export function InsightTable<T>(props: InsightTableProps<T>): React.ReactElement {
  const { data, isLoading, columns, headerText, onExport } = props;
  const { t } = useTranslation();
  if (isLoading) {
    return <TableLoader columns={columns} rows={5} />;
  }

  return (
    <div className="">
      <DataTable
        columns={columns}
        data={data || []}
        searchPlaceholder={`${data?.length || 0} ${headerText}`}
        actions={(table: Table<T>) => (
          <Button
            variant="secondary"
            prependIcon={<Download className="h-3.5 w-3.5" />}
            onClick={() => onExport?.(table.getFilteredRowModel().rows)}
          >
            <div>{t("exporter.csv.short_description")}</div>
          </Button>
        )}
      />
    </div>
  );
}
