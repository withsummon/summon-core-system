/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// local imports
import type { TMemberFilterProps } from "./member-filter";
import { MemberFilter } from "./member-filter";

export const FilterMembers = observer(function FilterMembers(props: TMemberFilterProps) {
  return <MemberFilter {...props} title="Members" keyPrefix="member" />;
});
