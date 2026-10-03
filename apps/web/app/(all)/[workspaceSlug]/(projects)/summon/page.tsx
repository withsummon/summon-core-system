/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { PageHead } from "@/components/core/page-title";
import { HomeRoot } from "@/components/summon/home";

export default function SummonOverviewPage() {
  return (
    <>
      <PageHead title="Home · Summon Core" />
      <HomeRoot />
    </>
  );
}
