/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { getCoreAuthenticationModesMap } from "./core";
import type { TGetAuthenticationModeProps } from "./types";

export const useAuthenticationModes = (props: TGetAuthenticationModeProps) => {
  // derived values
  const authenticationModes = getCoreAuthenticationModesMap(props);

  const availableAuthenticationModes = [
    authenticationModes["unique-codes"],
    authenticationModes["passwords-login"],
    authenticationModes["google"],
    authenticationModes["github"],
    authenticationModes["gitlab"],
    authenticationModes["gitea"],
  ];

  return availableAuthenticationModes;
};
