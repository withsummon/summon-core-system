/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ThemeProvider } from "next-themes";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient, type ReactAuthClient } from "better-auth/react";
import { emailOTPClient, genericOAuthClient } from "better-auth/client/plugins";
// components
import { TranslationProvider } from "@plane/i18n";
import { AppProgressBar } from "@/lib/b-progress";
import { ToastProvider } from "@/lib/toast-provider";

export const authClient: ReactAuthClient<{
  plugins: [
    ReturnType<typeof convexClient>,
    ReturnType<typeof crossDomainClient>,
    ReturnType<typeof emailOTPClient>,
    ReturnType<typeof genericOAuthClient>,
  ];
}> = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  plugins: [convexClient(), crossDomainClient(), emailOTPClient(), genericOAuthClient()],
});

const url = import.meta.env.VITE_CONVEX_URL;
export const convex = url ? new ConvexReactClient(url) : null;
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    void convex?.close();
  });

export async function getAuthToken() {
  return (await authClient.convex.token({ fetchOptions: { throw: true } })).token;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  if (!convex || !import.meta.env.VITE_CONVEX_SITE_URL)
    return (
      <div role="alert" className="p-8">
        Public sharing is unavailable. Please contact your workspace administrator.
      </div>
    );
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <ThemeProvider themes={["light", "dark"]} defaultTheme="system" enableSystem>
        <AppProgressBar />
        <TranslationProvider>
          <ToastProvider>{children}</ToastProvider>
        </TranslationProvider>
      </ThemeProvider>
    </ConvexBetterAuthProvider>
  );
}
