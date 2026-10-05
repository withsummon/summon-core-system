/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { authClient, getAuthToken } from "@/app/providers";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Link } from "react-router";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut } from "lucide-react";
import { Popover } from "@plane/propel/popover";
// plane imports
import { Button } from "@plane/propel/button";
import { Avatar } from "@plane/ui";
// helpers
// hooks
import { useUser } from "@/hooks/store/use-user";

export function UserAvatar() {
  const pathName = usePathname();
  const searchParams = useSearchParams();
  // hooks
  const { profile: currentUser, isAuthenticated } = useUser();
  const appearance = useQuery(api.identity.avatar.get, isAuthenticated ? {} : "skip");
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [pending, setPending] = useState(false);
  const avatar = appearance?.avatar;
  useEffect(() => {
    setAvatarUrl(undefined);
    if (!avatar) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void (async () => {
      const token = await getAuthToken();
      const response = await fetch(new URL(avatar.downloadPath, import.meta.env.VITE_CONVEX_SITE_URL), {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        redirect: "error",
      });
      if (!response.ok) throw new Error("Your profile image is unavailable.");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setAvatarUrl(objectUrl);
    })().catch((failure) => {
      if (!controller.signal.aborted)
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "Profile image",
          message: failure instanceof Error ? failure.message : "Could not load your profile image.",
        });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [avatar]);
  const signOut = async () => {
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
    } catch (failure) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Sign out",
        message: failure instanceof Error ? failure.message : "Could not sign out. Try again.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative mr-2">
      {currentUser?.id ? (
        <Popover>
          <Popover.Button
            render={
              <button
                type="button"
                aria-label="Account menu"
                className="flex items-center gap-2 rounded-sm border border-subtle p-2"
              >
                <Avatar name={currentUser.displayName} src={avatarUrl} shape="square" size="sm" showTooltip={false} />
                <h6 className="hidden max-w-32 truncate text-11 font-medium text-secondary sm:block">
                  {currentUser.displayName || currentUser.email || "User"}
                </h6>
              </button>
            }
          />
          <Popover.Panel positionerClassName="z-50" placement="bottom-end">
            <div className="z-10 overflow-hidden rounded-sm border border-subtle bg-surface-1 p-1 shadow-raised-200">
              <button
                type="button"
                disabled={pending}
                onClick={() => void signOut()}
                className="flex min-w-36 cursor-pointer items-center gap-2 rounded-sm p-2 text-13 whitespace-nowrap hover:bg-layer-transparent-hover"
              >
                <LogOut size={12} className="shrink-0 text-danger-primary" />
                <span>Sign out</span>
              </button>
            </div>
          </Popover.Panel>
        </Popover>
      ) : (
        <div className="flex-shrink-0">
          <Link to={`/?${new URLSearchParams({ next_path: `${pathName}?${searchParams}` })}`}>
            <Button variant="secondary">Sign in</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
