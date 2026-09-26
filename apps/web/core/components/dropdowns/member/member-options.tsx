/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
// plane imports
import { useTranslation } from "@plane/i18n";
import { CheckIcon, SearchIcon, SuspendedUserIcon } from "@plane/propel/icons";
import { EPillSize, EPillVariant, Pill } from "@plane/propel/pill";
import type { IUserLite } from "@plane/types";
import { Avatar } from "@plane/ui";
import { cn, getFileURL, sortByCurrentUserThenSelected } from "@plane/utils";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useUser } from "@/hooks/store/user";

interface Props {
  className?: string;
  getUserDetails: (userId: string) => IUserLite | undefined;
  memberIds?: string[];
  optionsClassName?: string;
  value?: string[] | string | null;
}

export const MemberOptions = observer(function MemberOptions(props: Props) {
  const {
    getUserDetails,
    memberIds,
    optionsClassName = "",

    value,
  } = props;
  // router
  const { workspaceSlug } = useParams();
  // refs
  // states
  const [query, setQuery] = useState("");

  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { data: currentUser } = useUser();
  const {
    workspace: { isUserSuspended },
  } = useMember();

  const options = memberIds
    ?.map((userId) => {
      const userDetails = getUserDetails(userId);
      return {
        value: userId,
        query: `${userDetails?.display_name} ${userDetails?.first_name} ${userDetails?.last_name}`,
        content: (
          <div className="flex items-center gap-2">
            <div className="w-4">
              {isUserSuspended(userId, workspaceSlug?.toString()) ? (
                <SuspendedUserIcon className="h-3.5 w-3.5 text-placeholder" />
              ) : (
                <Avatar name={userDetails?.display_name} src={getFileURL(userDetails?.avatar_url ?? "")} />
              )}
            </div>
            <span
              className={cn(
                "flex-grow truncate",
                isUserSuspended(userId, workspaceSlug?.toString()) ? "text-placeholder" : ""
              )}
            >
              {currentUser?.id === userId ? t("you") : userDetails?.display_name}
            </span>
          </div>
        ),
      };
    })
    .filter((o) => !!o);

  const filteredOptions = sortByCurrentUserThenSelected(
    query === "" ? options : options?.filter((o) => o?.query.toLowerCase().includes(query.toLowerCase())),
    value,
    currentUser?.id
  );

  return (
    <div data-prevent-outside-click>
      <div
        className={cn(
          "z-30 my-1 w-48 rounded-sm border-[0.5px] border-strong bg-surface-1 px-2 py-2.5 text-11 shadow-raised-200 focus:outline-none",
          optionsClassName
        )}
      >
        <div className="flex items-center gap-1.5 rounded-sm border border-subtle bg-surface-2 px-2">
          <SearchIcon className="h-3.5 w-3.5 text-placeholder" strokeWidth={1.5} />
          <Combobox.Input
            className="w-full bg-transparent py-1 text-11 text-secondary placeholder:text-placeholder focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
          />
        </div>
        <Combobox.List className="mt-2 max-h-48 space-y-1 overflow-y-scroll">
          {filteredOptions ? (
            filteredOptions.length > 0 ? (
              filteredOptions.map(
                (option) =>
                  option && (
                    <Combobox.Item
                      key={option.value}
                      value={option.value}
                      className={({ highlighted: active, selected }) =>
                        cn(
                          "flex w-full items-center justify-between gap-2 truncate rounded-sm px-1 py-1.5 select-none",
                          active && "bg-layer-transparent-hover",
                          selected ? "text-primary" : "text-secondary",
                          isUserSuspended(option.value, workspaceSlug?.toString())
                            ? "cursor-not-allowed"
                            : "cursor-pointer"
                        )
                      }
                      disabled={isUserSuspended(option.value, workspaceSlug?.toString())}
                      render={(itemProps, { selected }) => (
                        <div {...itemProps}>
                          {
                            <>
                              <span className="flex-grow truncate">{option.content}</span>
                              {selected && <CheckIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                              {isUserSuspended(option.value, workspaceSlug?.toString()) && (
                                <Pill variant={EPillVariant.DEFAULT} size={EPillSize.XS} className="border-none">
                                  Suspended
                                </Pill>
                              )}
                            </>
                          }
                        </div>
                      )}
                    ></Combobox.Item>
                  )
              )
            ) : (
              <p className="px-1.5 py-1 text-placeholder italic">{t("no_matching_results")}</p>
            )
          ) : (
            <p className="px-1.5 py-1 text-placeholder italic">{t("loading")}</p>
          )}
        </Combobox.List>
      </div>
    </div>
  );
});
