/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { SITE_TITLE } from "@plane/constants";
import { AuthRoot } from "@/components/account/auth-forms/auth-root";
import { SummonCoreLogo, SummonLogo } from "@/components/summon/brand";
import { SummonThemeToggle } from "@/components/summon/theme-toggle";
import type { EAuthModes } from "@/helpers/authentication.helper";
import { SummonArtwork } from "./summon-artwork";

type AuthBaseProps = {
  authType: EAuthModes;
};

/*
 * The art panel keeps Summon's brand blue in both themes, the way a logo does.
 * Hue 265.8 is the brand ramp in tailwind-config/variables.css.
 */
const ART_BACKGROUND =
  "radial-gradient(120% 90% at 70% 75%, oklch(0.47 0.2 265.8) 0%, oklch(0.32 0.14 265.8) 45%, oklch(0.16 0.05 265.8) 100%)";

/** Sign-in: the form column on the page, generated brand art beside it (above it on phones). */
export function AuthBase({ authType }: AuthBaseProps) {
  return (
    <div className="relative z-10 grid min-h-dvh w-full bg-surface-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex min-w-0 flex-col px-5 sm:px-10">
        <header className="flex h-16 flex-none items-center justify-between lg:h-20">
          <SummonCoreLogo />
          <SummonThemeToggle />
        </header>
        <div
          className="relative -mx-1 h-40 overflow-hidden rounded-2xl lg:hidden"
          style={{ background: ART_BACKGROUND }}
          aria-hidden="true"
        >
          <SummonArtwork className="absolute inset-0 size-full" />
        </div>
        <main className="mx-auto flex w-full max-w-[24rem] flex-1 flex-col gap-6 py-10 lg:justify-center lg:pb-24">
          <AuthRoot authMode={authType} />
        </main>
      </div>

      <aside
        className="relative m-3 hidden overflow-hidden rounded-3xl lg:block"
        style={{ background: ART_BACKGROUND }}
        aria-label={`${SITE_TITLE} artwork`}
      >
        <SummonArtwork className="absolute inset-0 size-full" />
        <div className="relative max-w-md p-12 pt-16 text-white">
          <SummonLogo variant="mark" className="size-10 text-white" />
          <p className="mt-4 text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.025em] text-balance">
            Every client, project, and handoff in one place.
          </p>
        </div>
      </aside>
    </div>
  );
}
