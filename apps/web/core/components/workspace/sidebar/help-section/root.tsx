/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { observer } from "mobx-react";
import { HelpMenuView } from "./view";
// ui
// components
import { ProductUpdatesModal } from "@/components/global";
// hooks
import { usePowerK } from "@/hooks/store/use-power-k";

export const HelpMenuRoot = observer(function HelpMenuRoot() {
  // store hooks
  const { toggleShortcutsListModal } = usePowerK();
  // states
  const [isProductUpdatesModalOpen, setProductUpdatesModalOpen] = useState(false);

  return (
    <>
      <ProductUpdatesModal isOpen={isProductUpdatesModalOpen} handleClose={() => setProductUpdatesModalOpen(false)} />

      <HelpMenuView
        onShortcuts={() => toggleShortcutsListModal(true)}
        onUpdates={() => setProductUpdatesModalOpen(true)}
      />
    </>
  );
});
