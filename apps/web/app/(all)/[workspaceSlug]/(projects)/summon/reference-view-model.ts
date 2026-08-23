/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ISummonCredential, ISummonOpportunity, TSummonOpportunityStage } from "@plane/types";

export function filterOpportunityRecords(
  opportunities: ISummonOpportunity[],
  clientNames: ReadonlyMap<string, string>,
  query: string,
  stage: "all" | TSummonOpportunityStage
) {
  const normalizedQuery = query.trim().toLowerCase();
  return opportunities.filter((opportunity) => {
    if (stage !== "all" && opportunity.stage !== stage) return false;
    if (!normalizedQuery) return true;
    const clientName = opportunity.client ? clientNames.get(opportunity.client) : "";
    return [opportunity.title, opportunity.product, opportunity.source, opportunity.description, clientName]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedQuery));
  });
}

export function summarizeCredentials(credentials: ISummonCredential[], currentUserId: string, now: Date) {
  const expiryLimit = new Date(now);
  expiryLimit.setDate(expiryLimit.getDate() + 30);
  return credentials.reduce(
    (summary, credential) => {
      summary.total += 1;
      if (credential.status === "active") summary.active += 1;
      if (currentUserId && credential.owner && credential.owner !== currentUserId) summary.sharedWithMe += 1;
      const expiresAt =
        typeof credential.metadata.expires_at === "string" ? new Date(credential.metadata.expires_at) : null;
      if (
        credential.status === "active" &&
        expiresAt &&
        Number.isFinite(expiresAt.getTime()) &&
        expiresAt >= now &&
        expiresAt <= expiryLimit
      )
        summary.expiringSoon += 1;
      const risk = credential.metadata.risk;
      if (risk === true || risk === "high" || risk === "critical") summary.risky += 1;
      return summary;
    },
    { total: 0, active: 0, sharedWithMe: 0, expiringSoon: 0, risky: 0 }
  );
}
