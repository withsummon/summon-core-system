/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// ui
import { Button } from "@plane/propel/button";
import type { IExportData } from "@plane/types";
// helpers
import { getDate, renderFormattedDate } from "@plane/utils";
// types

type Props = {
  service: IExportData;
  refreshing: boolean;
};

const PROVIDER_LABELS: Record<string, string> = { csv: "CSV", xlsx: "Excel", json: "JSON" };

const STATUS_CLASSNAMES: Record<string, string> = {
  completed: "bg-success-subtle text-success-primary",
  processing: "bg-warning-subtle text-warning-primary",
  failed: "bg-danger-subtle text-danger-primary",
  expired: "bg-layer-1 text-tertiary",
};

const checkExpiry = (inputDateString: string) => {
  const currentDate = new Date();
  const expiryDate = getDate(inputDateString);
  if (!expiryDate) return false;
  expiryDate.setDate(expiryDate.getDate() + 7);
  return expiryDate > currentDate;
};

function ExportAction({ service, isLoading }: { service: IExportData; isLoading: boolean }) {
  if (!checkExpiry(service.created_at)) return <div className="text-11 text-danger-primary">Expired</div>;
  if (service.status != "completed") return null;
  return (
    <div>
      <a target="_blank" href={service?.url} rel="noopener noreferrer">
        <Button variant="primary" className="w-full">
          {isLoading ? "Downloading…" : "Download"}
        </Button>
      </a>
    </div>
  );
}

export function SingleExport({ service, refreshing }: Props) {
  const provider = service.provider;

  const [isLoading] = useState(false);

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      <div>
        <h4 className="flex items-center gap-2 text-13">
          <span>
            Export to <span className="font-medium">{PROVIDER_LABELS[provider] ?? ""}</span>{" "}
          </span>
          <span className={`rounded-sm px-2 py-0.5 text-11 capitalize ${STATUS_CLASSNAMES[service.status] ?? ""}`}>
            {refreshing ? "Refreshing…" : service.status}
          </span>
        </h4>
        <div className="mt-2 flex items-center gap-2 text-11 text-secondary">
          <span>{renderFormattedDate(service.created_at)}</span>|
          <span>Exported by {service?.initiated_by_detail?.display_name}</span>
        </div>
      </div>
      <ExportAction service={service} isLoading={isLoading} />
    </div>
  );
}
