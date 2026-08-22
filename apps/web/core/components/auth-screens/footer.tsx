/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ShieldCheck } from "lucide-react";

export function AuthFooter() {
  return (
    <p className="text-xs flex items-center justify-center gap-2 text-tertiary">
      <ShieldCheck className="size-3.5 text-accent-primary" />
      Secure login · Your data is encrypted and protected
    </p>
  );
}
