/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// ui
import { ArrowDownWideNarrow, ArrowUpNarrowWide, CheckIcon, ChevronDownIcon, Eraser, MoveRight } from "lucide-react";
import type { IProjectMemberDisplayProperties } from "@plane/constants";
import { MEMBER_PROPERTY_DETAILS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { CustomMenu } from "@plane/ui";

type Props = {
  property: keyof IProjectMemberDisplayProperties;
  direction?: "asc" | "desc";
  onOrderChange: (direction?: "asc" | "desc") => void;
};

export function MemberHeaderColumn({ property, direction, onOrderChange }: Props) {
  const { t } = useTranslation();
  const details = MEMBER_PROPERTY_DETAILS[property];
  const SortIcon = direction === "asc" ? ArrowDownWideNarrow : ArrowUpNarrowWide;
  return (
    <CustomMenu
      ariaLabel={`Sort by ${t(details.i18n_title)}`}
      customButtonClassName="clickable !w-full"
      className="!w-full"
      customButton={
        <span className="flex w-full items-center justify-between gap-1.5 py-2 text-13 text-secondary hover:text-primary">
          <span>{t(details.i18n_title)}</span>
          <span className="ml-3 flex">
            {direction && <SortIcon className="h-3 w-3" aria-hidden="true" />}
            <ChevronDownIcon className="h-3 w-3" aria-hidden="true" />
          </span>
        </span>
      }
      placement="bottom-end"
      closeOnSelect
    >
      {(["asc", "desc"] as const).map((order) => {
        const Icon = order === "asc" ? ArrowDownWideNarrow : ArrowUpNarrowWide;
        return (
          <CustomMenu.MenuItem key={order} onClick={() => onOrderChange(order)}>
            <span
              className={`flex w-full items-center justify-between gap-1.5 px-1 ${direction === order ? "text-primary" : "text-secondary hover:text-primary"}`}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-3 w-3 stroke-[1.5]" aria-hidden="true" />
                <span>{order === "asc" ? details.ascendingOrderTitle : details.descendingOrderTitle}</span>
                <MoveRight className="h-3 w-3" aria-hidden="true" />
                <span>{order === "asc" ? details.descendingOrderTitle : details.ascendingOrderTitle}</span>
              </span>
              {direction === order && <CheckIcon className="h-3 w-3" aria-hidden="true" />}
            </span>
          </CustomMenu.MenuItem>
        );
      })}
      {direction && (
        <CustomMenu.MenuItem onClick={() => onOrderChange()}>
          <Eraser className="h-3 w-3" aria-hidden="true" />
          <span>{t("common.actions.clear_sorting")}</span>
        </CustomMenu.MenuItem>
      )}
    </CustomMenu>
  );
}
