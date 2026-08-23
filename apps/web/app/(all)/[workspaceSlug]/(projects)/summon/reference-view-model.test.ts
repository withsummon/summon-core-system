/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node's strip-types test runner requires the source extension.
import { filterOpportunityRecords, summarizeCredentials } from "./reference-view-model.ts";

test("opportunity master list applies stage and cross-record search together", () => {
  const opportunities = [
    {
      id: "opportunity-a",
      client: "client-a",
      owner: null,
      title: "Core Banking Upgrade",
      product: "Summon Delivery",
      source: "Referral",
      description: "",
      stage: "qualified" as const,
      probability: 40,
      value: "150000000",
      expected_close_date: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-20T00:00:00Z",
    },
    {
      id: "opportunity-b",
      client: "client-b",
      owner: null,
      title: "Document Automation",
      product: "Automation",
      source: "Inbound",
      description: "",
      stage: "lead" as const,
      probability: 10,
      value: null,
      expected_close_date: null,
      created_at: "2026-08-02T00:00:00Z",
      updated_at: "2026-08-21T00:00:00Z",
    },
  ];

  const result = filterOpportunityRecords(
    opportunities,
    new Map([
      ["client-a", "Bank Nusantara"],
      ["client-b", "Retail Sentosa"],
    ]),
    "bank",
    "qualified"
  );

  assert.deepEqual(
    result.map((item) => item.id),
    ["opportunity-a"]
  );
});

test("credential metrics derive shared, expiry, and risk counts without synthetic values", () => {
  const credentials = [
    {
      id: "credential-a",
      project: null,
      owner: "current-user",
      name: "Production server",
      provider: "server",
      account_identifier: "deploy@example.com",
      secret: "••••••••" as const,
      metadata: { expires_at: "2026-09-10T00:00:00Z" },
      status: "active" as const,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-08-20T00:00:00Z",
    },
    {
      id: "credential-b",
      project: null,
      owner: "another-user",
      name: "Shared API key",
      provider: "api_key",
      account_identifier: "service-account",
      secret: "••••••••" as const,
      metadata: { risk: "high" },
      status: "active" as const,
      created_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-08-21T00:00:00Z",
    },
    {
      id: "credential-c",
      project: null,
      owner: "current-user",
      name: "Old token",
      provider: "other",
      account_identifier: "",
      secret: "••••••••" as const,
      metadata: {},
      status: "revoked" as const,
      created_at: "2026-01-03T00:00:00Z",
      updated_at: "2026-08-22T00:00:00Z",
    },
  ];

  assert.deepEqual(summarizeCredentials(credentials, "current-user", new Date("2026-08-23T00:00:00Z")), {
    total: 3,
    active: 2,
    sharedWithMe: 1,
    expiringSoon: 1,
    risky: 1,
  });
});
