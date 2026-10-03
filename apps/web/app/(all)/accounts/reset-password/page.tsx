/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { EAuthModes } from "@plane/constants";
import { AuthBase } from "@/components/auth-screens/auth-base";

export default function PasswordRecoveryPage() {
  return <AuthBase authType={EAuthModes.SIGN_IN} initialStep="reset" />;
}
