/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { getWorkspaceHomePath } from "@plane/constants";
import { observer } from "mobx-react";
import Link from "next/link";
import { CheckIcon } from "@phosphor-icons/react";
import { useTranslation } from "@plane/i18n";
import { MENU_ITEM_CLASSNAME, MenuPrimitive as Menu } from "@plane/propel/menu";
import type { IWorkspace } from "@plane/types";
import { capitalizeFirstLetter, cn, getUserRole } from "@plane/utils";
import { WorkspaceLogo } from "../logo";

type TProps = {
  workspace: IWorkspace;
  isActive: boolean;
  onSelect: () => void;
};

/** One workspace in the switcher: logo, name, your role and its size; the current one is tinted and checked. */
const SidebarDropdownItem = observer(function SidebarDropdownItem(props: TProps) {
  const { workspace, isActive, onSelect } = props;
  const { t } = useTranslation();
  const role = capitalizeFirstLetter(getUserRole(workspace.role)?.toLowerCase() || "guest");

  return (
    <Menu.Item
      render={<Link href={getWorkspaceHomePath(workspace.slug)} />}
      onClick={onSelect}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        MENU_ITEM_CLASSNAME,
        "gap-2.5 py-1.5",
        isActive && "bg-accent-subtle data-[highlighted]:bg-accent-subtle-hover"
      )}
    >
      <WorkspaceLogo
        logo={workspace.logo_url}
        name={workspace.name}
        classNames="size-7 rounded-md text-12 font-semibold"
      />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-13 font-medium", isActive ? "text-accent-primary" : "text-primary")}>
          {workspace.name}
        </span>
        <span className="block truncate text-12 text-tertiary">
          {role} · {t("member", { count: workspace.total_members || 0 })}
        </span>
      </span>
      {isActive ? <CheckIcon weight="bold" className="size-4 flex-none text-accent-primary" /> : null}
    </Menu.Item>
  );
});

export default SidebarDropdownItem;
