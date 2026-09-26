/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";

import { useTheme } from "next-themes";
import { ArrowRightLeft } from "lucide-react";
import { Dialog } from "@plane/propel/dialog";
// ui
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// hooks
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function SwitchAccountModal(props: Props) {
  const { isOpen, onClose } = props;
  // states
  const [switchingAccount, setSwitchingAccount] = useState(false);
  // router
  const router = useAppRouter();
  // store hooks
  const { data: userData, signOut } = useUser();

  const { setTheme } = useTheme();

  const handleClose = () => {
    setSwitchingAccount(false);
    onClose();
  };

  const handleSwitchAccount = async () => {
    setSwitchingAccount(true);

    await signOut()
      .then(() => {
        setTheme("system");
        router.push("/");
        handleClose();
      })
      .catch(() =>
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "Error!",
          message: "Failed to sign out. Please try again.",
        })
      )
      .finally(() => setSwitchingAccount(false));
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Dialog.Panel className="sm:max-w-[40rem]">
        <div className="p-6 pb-1">
          <div className="flex gap-x-4">
            <div className="flex items-start">
              <div className="grid place-items-center rounded-full bg-accent-primary/20 p-4">
                <ArrowRightLeft className="h-5 w-5 text-accent-primary" aria-hidden="true" />
              </div>
            </div>
            <div className="flex flex-col gap-y-6 py-3">
              <Dialog.Title className="text-20 leading-6 font-medium text-primary">Switch account</Dialog.Title>
              {userData?.email && (
                <div className="text-14 font-regular text-secondary">
                  If you have signed up via <span className="text-accent-primary">{userData.email}</span>{" "}
                  un-intentionally, you can switch your account to a different one from here.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mb-2 flex items-center justify-end gap-3 p-4 sm:px-6">
          <Button variant="secondary" size="lg" onClick={handleSwitchAccount} disabled={switchingAccount}>
            {switchingAccount ? "Switching..." : "Switch account"}
          </Button>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
