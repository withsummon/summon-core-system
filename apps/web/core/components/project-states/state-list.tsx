/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentProps } from "react";
import { StateItem } from "./state-item";
type Props = Omit<ComponentProps<typeof StateItem>, "state">;
export function StateList(props: Props) {
  return props.states
    .filter((state) => state.status === props.status)
    .map((state) => <StateItem key={state._id} {...props} state={state} />);
}
