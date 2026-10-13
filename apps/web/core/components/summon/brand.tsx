/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import markUrl from "@/app/assets/logos/summon-mark.png?url";
import wordmarkUrl from "@/app/assets/logos/summon-wordmark.png?url";
import { cn } from "@plane/utils";

const LOGOS = {
  mark: { url: markUrl, ratio: 91 / 90 },
  wordmark: { url: wordmarkUrl, ratio: 534 / 124 },
};

/**
 * The Summon logo. The source art is white on transparent, so it is used as a mask over
 * `currentColor`: one asset follows the text color in light mode, dark mode, and on the art panel.
 * Size it by height (e.g. `h-6`); the width follows the logo's proportions.
 */
export function SummonLogo(props: { variant?: keyof typeof LOGOS; className?: string }) {
  const { url, ratio } = LOGOS[props.variant ?? "wordmark"];
  return (
    <span
      role="img"
      aria-label="Summon"
      className={cn("inline-block bg-current", props.className)}
      style={{
        aspectRatio: ratio,
        maskImage: `url(${url})`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
      }}
    />
  );
}

/** The product lockup: the Summon wordmark followed by a quiet "Core". */
export function SummonCoreLogo(props: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-primary", props.className)}>
      <SummonLogo className="h-5" />
      <span className="text-13 font-medium tracking-tight text-tertiary">Core</span>
    </span>
  );
}
