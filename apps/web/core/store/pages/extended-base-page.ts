/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TPage, TPageExtended } from "@plane/types";
import type { CoreRootStore } from "@/store/root.store";
import type { TBasePageServices } from "@/store/pages/base-page";

export type TExtendedPageInstance = TPageExtended & {
  asJSONExtended: TPageExtended;
  googleDriveUrl: string | undefined;
};

export class ExtendedBasePage implements TExtendedPageInstance {
  /** The Google Drive file a synced page mirrors. */
  readonly googleDriveUrl: string | undefined;

  // oxlint-disable-next-line no-unused-vars
  constructor(store: CoreRootStore, page: TPage, services: TBasePageServices) {
    const source = page.view_props?.summon_document;
    this.googleDriveUrl = source?.kind === "google_drive" && source.url ? source.url : undefined;
  }

  get asJSONExtended(): TExtendedPageInstance["asJSONExtended"] {
    // view_props stays out: every page update sends this JSON, and the sync, not the editor, owns that field.
    return {};
  }
}
