/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { ArrowRight, Calendar } from "lucide-react";
import { DISBURSEMENT_PROGRESS } from "./mock-data";

export function DisbursementProgressCard() {
  return (
    <div className="shadow-sm flex h-full flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-5">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">Investment Disbursement Progress</h2>
          <button
            type="button"
            className="text-xs inline-flex items-center gap-1 font-medium text-accent-primary hover:underline"
          >
            View detail <ArrowRight className="size-3" />
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="text-xs w-full text-left">
            <thead>
              <tr className="border-b border-subtle text-[11px] font-semibold text-tertiary uppercase">
                <th className="pb-2.5 font-medium">Project</th>
                <th className="pb-2.5 font-medium">Client</th>
                <th className="pb-2.5 font-medium">Total Investment</th>
                <th className="pb-2.5 font-medium">Disbursed</th>
                <th className="pb-2.5 font-medium">Progress</th>
                <th className="pb-2.5 font-medium">Next Disbursement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {DISBURSEMENT_PROGRESS.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-layer-1">
                  <td className="py-3 font-semibold text-primary">{item.project}</td>
                  <td className="py-3 text-secondary">{item.client}</td>
                  <td className="py-3 font-medium text-primary">{item.totalInvestment}</td>
                  <td className="py-3 font-medium text-secondary">{item.disbursed}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-layer-2">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-primary">{item.progress}%</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-secondary">
                      <Calendar className="size-3 text-tertiary" />
                      {item.nextDisbursement}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs mt-4 flex items-center justify-between border-t border-subtle pt-3 text-secondary">
        <span>Showing 1 to 5 of 8 projects</span>
        <button type="button" className="font-semibold text-accent-primary hover:underline">
          View all disbursements →
        </button>
      </div>
    </div>
  );
}
