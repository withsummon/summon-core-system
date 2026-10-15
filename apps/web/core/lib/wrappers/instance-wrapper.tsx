/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
// hooks
import { useInstance } from "@/hooks/store/use-instance";
// local imports
import { getInstanceRetryDelay } from "./instance-retry";

type TInstanceWrapper = {
  children: ReactNode;
};

const InstanceWrapper = observer(function InstanceWrapper(props: TInstanceWrapper) {
  const { children } = props;
  // store
  const { instance, error, fetchInstanceInfo } = useInstance();

  // Every route reads the instance config (sign-in methods among them), so hold the app until it loads and keep
  // retrying while the API is unreachable, e.g. for the seconds a deploy restarts it.
  useSWR("INSTANCE_INFORMATION", () => fetchInstanceInfo(), {
    revalidateOnFocus: false,
    onErrorRetry: (_error, _key, _config, revalidate, { retryCount }) => {
      setTimeout(() => void revalidate({ retryCount }), getInstanceRetryDelay(retryCount));
    },
  });

  if (!instance)
    return (
      <div className="relative flex h-screen w-full flex-col items-center justify-center gap-4">
        <LogoSpinner />
        {error && (
          <p aria-live="polite" className="text-13 text-secondary">
            Can&apos;t reach Summon Core yet. Retrying…
          </p>
        )}
      </div>
    );

  return <>{children}</>;
});

export default InstanceWrapper;
