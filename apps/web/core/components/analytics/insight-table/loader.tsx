/* eslint-disable react/no-array-index-key -- Static loading skeletons have no interactive row identity. */
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@plane/propel/table";
import { Loader } from "@plane/ui";

interface TableSkeletonProps<T> {
  columns: ColumnDef<T>[];
  rows: number;
}

export function TableLoader<T>({ columns, rows }: TableSkeletonProps<T>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column, index) => (
            <TableHead key={column.header?.toString() ?? index}>
              {typeof column.header === "string" ? column.header : ""}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {columns.map((_column, colIndex) => (
              <TableCell key={colIndex}>
                <Loader.Item height="20px" width="100%" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
