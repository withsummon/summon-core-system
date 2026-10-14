/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { autorun } from "mobx";
import type { IReactionDisposer } from "mobx";
import type { RootStore } from "@/store/root.store";
import { BaseTimeLineStore } from "@/store/timeline/base-timeline.store";
import type { IBaseTimelineStore } from "@/store/timeline/base-timeline.store";

export interface IModulesTimeLineStore extends IBaseTimelineStore {
  isDependencyEnabled: boolean;
}

export class ModulesTimeLineStore extends BaseTimeLineStore implements IModulesTimeLineStore {
  /** Stops syncing timeline blocks from the store; call when the owner is torn down. */
  disposeBlocksSync: IReactionDisposer;

  constructor(_rootStore: RootStore) {
    super(_rootStore);

    this.disposeBlocksSync = autorun(() => {
      const getModuleById = this.rootStore.module.getModuleById;
      this.updateBlocks(getModuleById);
    });
  }
}
