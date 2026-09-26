/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CollapsiblePrimitive } from "@plane/propel/collapsible";
import { WORKSPACE_SETTINGS_TRACKER_ELEMENTS } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { ChevronDownIcon, ChevronUpIcon } from "@plane/propel/icons";

type Props = {
  openDeleteModal: () => void;
};

export function WebhookDeleteSection(props: Props) {
  const { openDeleteModal } = props;

  return (
    <CollapsiblePrimitive.Root
      className="border-t border-subtle"
      render={(rootProps, { open }) => (
        <div {...rootProps}>
          {
            <div className="w-full">
              <CollapsiblePrimitive.Trigger type="button" className="flex w-full items-center justify-between py-4">
                <span className="text-16 tracking-tight">Danger zone</span>
                {open ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
              </CollapsiblePrimitive.Trigger>

              {open && (
                <>
                  <CollapsiblePrimitive.Panel>
                    <div className="flex flex-col gap-8">
                      <span className="text-13 tracking-tight">
                        Once a webhook is deleted, it cannot be restored. Future events will no longer be delivered to
                        this webhook.
                      </span>
                      <div>
                        <Button
                          variant="error-fill"
                          size="lg"
                          onClick={openDeleteModal}
                          data-ph-element={WORKSPACE_SETTINGS_TRACKER_ELEMENTS.WEBHOOK_DELETE_BUTTON}
                        >
                          Delete webhook
                        </Button>
                      </div>
                    </div>
                  </CollapsiblePrimitive.Panel>
                </>
              )}
            </div>
          }
        </div>
      )}
    ></CollapsiblePrimitive.Root>
  );
}
