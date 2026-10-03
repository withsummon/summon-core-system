/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import { AuthBase } from "@/components/auth-screens/auth-base";
// helpers
import { EAuthModes } from "@plane/constants";

function SignUpPage() {
  return <AuthBase authType={EAuthModes.SIGN_UP} />;
}

export default SignUpPage;
