/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// components
import type { TMemberFilterProps } from "@/components/common/filters/member-filter";
import { MemberFilter } from "@/components/common/filters/member-filter";

export const FilterLead = observer(function FilterLead(props: TMemberFilterProps) {
  return <MemberFilter {...props} title="Lead" />;
});
