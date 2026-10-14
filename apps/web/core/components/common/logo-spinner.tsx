/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { SummonLogo } from "@/components/summon/brand";

/**
 * The full-screen loader: the Summon mark turning in place. Each turn eases in and out so it reads as a
 * deliberate beat rather than a mechanical spinner; with reduced motion it pulses instead of turning.
 */
export function LogoSpinner() {
  return (
    <div role="status" aria-label="Loading" className="flex items-center justify-center text-primary">
      <SummonLogo
        variant="mark"
        className="size-6 animate-[spin_1.2s_cubic-bezier(0.65,0,0.35,1)_infinite] motion-reduce:animate-pulse sm:size-10"
      />
    </div>
  );
}
