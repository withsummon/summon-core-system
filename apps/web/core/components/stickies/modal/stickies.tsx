/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";

// plane ui
import { StickiesModalView } from "./view";
// hooks
import { useSticky } from "@/hooks/use-stickies";
// components
import { StickiesTruncated } from "../layout/stickies-truncated";
import { useStickyOperations } from "../sticky/use-operations";
import { StickySearch } from "./search";

type TProps = {
  handleClose?: () => void;
};

export const Stickies = observer(function Stickies(props: TProps) {
  const { handleClose } = props;
  // navigation
  const { workspaceSlug } = useParams();
  // store hooks
  const { creatingSticky, toggleShowNewSticky } = useSticky();
  // sticky operations
  const { stickyOperations } = useStickyOperations({ workspaceSlug: workspaceSlug?.toString() });

  return (
    <StickiesModalView
      handleClose={handleClose}
      creatingSticky={creatingSticky}
      create={() => {
        toggleShowNewSticky(true);
        stickyOperations.create();
      }}
      search={<StickySearch />}
    >
      <StickiesTruncated handleClose={handleClose} />
    </StickiesModalView>
  );
});
