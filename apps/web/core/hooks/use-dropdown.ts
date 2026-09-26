/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

type TArguments = {
  onClose?: () => void;
  onOpen?: () => Promise<void> | void;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setQuery?: React.Dispatch<React.SetStateAction<string>>;
};

/** Domain callbacks follow Base UI's open state; focus, keyboard, and dismissal stay with the primitive. */
export const useDropdown = ({ onClose, onOpen, setIsOpen, setQuery }: TArguments) => {
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      void onOpen?.();
    } else {
      setQuery?.("");
      onClose?.();
    }
  };

  return { handleOpenChange, handleClose: () => handleOpenChange(false) };
};
