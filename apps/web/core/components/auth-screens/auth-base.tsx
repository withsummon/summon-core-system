/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { FolderKanban, ShieldCheck, Sparkles } from "lucide-react";
import { AuthRoot } from "@/components/account/auth-forms/auth-root";
import { SummonThemeToggle } from "@/components/summon/theme-toggle";
import type { EAuthModes } from "@/helpers/authentication.helper";
import { AuthFooter } from "./footer";
import { AuthHeader } from "./header";

type AuthBaseProps = {
  authType: EAuthModes;
};

export function AuthBase({ authType }: AuthBaseProps) {
  return (
    <div className="relative z-10 min-h-screen w-full overflow-y-auto bg-[#f3f6ff] p-3 sm:p-6 lg:p-8 dark:bg-[#0d111b]">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-3xl border border-[#dfe6f5] bg-white shadow-[0_24px_80px_rgba(40,72,145,0.14)] sm:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[0.9fr_1.1fr] dark:border-[#293247] dark:bg-[#121824] dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <aside
          className="relative hidden overflow-hidden bg-gradient-to-br from-[#edf3ff] via-[#f7f9ff] to-white p-10 lg:flex lg:flex-col dark:from-[#121c32] dark:via-[#151b29] dark:to-[#121824]"
          aria-label="Summon Core product overview"
        >
          <div className="text-base relative z-10 flex items-center gap-2 font-semibold text-[#111827] dark:text-white">
            <span className="grid size-8 place-items-center rounded-xl bg-[#2f5bea] text-white">
              <Sparkles className="size-4" />
            </span>
            summon
          </div>
          <div className="relative z-10 mt-16 max-w-sm">
            <h1 className="text-4xl leading-tight font-semibold tracking-tight text-[#17213a] dark:text-white">
              Welcome to
              <br />
              Summon <span className="text-[#2f5bea]">Core</span>
            </h1>
            <p className="text-sm mt-4 leading-6 text-[#64708a] dark:text-[#aeb9ce]">
              Your central workspace for projects, knowledge, automation, and everything that drives Summon forward.
            </p>
            <div className="mt-8 space-y-5">
              {[
                {
                  Icon: FolderKanban,
                  title: "All in one place",
                  copy: "Projects, clients, documents, and tools unified in a single workspace.",
                },
                {
                  Icon: Sparkles,
                  title: "AI-powered productivity",
                  copy: "Automate proposals, meetings, and project insights with Summon AI.",
                },
                {
                  Icon: ShieldCheck,
                  title: "Secure & private",
                  copy: "Enterprise-grade security keeps your data and work protected.",
                },
              ].map(({ Icon, title, copy }) => (
                <div key={title} className="flex items-start gap-3">
                  <span className="shadow-sm grid size-9 flex-shrink-0 place-items-center rounded-xl bg-white text-[#2f5bea] dark:bg-[#202a3e] dark:text-[#7da0ff]">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#17213a] dark:text-white">{title}</p>
                    <p className="text-xs mt-1 leading-5 text-[#7a849b] dark:text-[#9daac0]">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-28 -left-20 size-80 rounded-full border border-[#9fb8ff]/50 bg-white/60 shadow-[0_0_80px_rgba(47,91,234,0.22)] dark:border-[#4268c9]/30 dark:bg-[#1d2c4a]/50" />
          <div className="absolute right-12 bottom-20 size-28 rotate-12 rounded-[2rem] border border-white/80 bg-gradient-to-br from-white/90 to-[#b8ccff]/50 shadow-[0_18px_50px_rgba(47,91,234,0.2)] dark:border-[#4268c9]/30 dark:from-[#24324c] dark:to-[#17284f]" />
          <div className="absolute bottom-10 left-48 size-20 rounded-full bg-gradient-to-br from-white to-[#84a6ff]/50 shadow-[0_16px_42px_rgba(47,91,234,0.22)]" />
        </aside>
        <main className="relative flex min-w-0 flex-col bg-surface-1 p-5 sm:p-8 lg:p-10">
          <div className="absolute top-5 right-5">
            <SummonThemeToggle />
          </div>
          <AuthHeader type={authType} />
          <AuthRoot authMode={authType} />
          <AuthFooter />
        </main>
      </div>
    </div>
  );
}
