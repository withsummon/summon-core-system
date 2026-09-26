/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import type { TPlacement as Placement } from "@plane/propel/utils";
import { observer } from "mobx-react";
import { convertPlacementToSideAndAlign } from "@plane/propel/utils";
import { Component, Loader } from "lucide-react";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
import { getRandomLabelColor } from "@plane/constants";
// plane imports
import { useTranslation } from "@plane/i18n";
import { CheckIcon, SearchIcon, LabelPropertyIcon } from "@plane/propel/icons";
import type { IIssueLabel } from "@plane/types";
import { cn } from "@plane/utils";
// components
import { IssueLabelsList } from "@/components/ui/labels-list";
// hooks
import { useDropdown } from "@/hooks/use-dropdown";

export type TWorkItemLabelSelectBaseProps = {
  buttonClassName?: string;
  buttonContainerClassName?: string;
  createLabelEnabled?: boolean;
  disabled?: boolean;
  getLabelById: (labelId: string) => IIssueLabel | null;
  label?: React.ReactNode;
  labelIds: string[];
  onChange: (value: string[]) => void;
  onDropdownOpen?: () => void;
  placement?: Placement;
  createLabel?: (data: Partial<IIssueLabel>) => Promise<IIssueLabel>;
  tabIndex?: number;
  value: string[];
};

export const WorkItemLabelSelectBase = observer(function WorkItemLabelSelectBase(props: TWorkItemLabelSelectBaseProps) {
  const {
    buttonClassName,
    buttonContainerClassName,
    createLabelEnabled = false,
    disabled = false,
    getLabelById,
    label,
    labelIds,
    onChange,
    onDropdownOpen,
    placement,
    createLabel,
    tabIndex,
    value,
  } = props;
  // refs
  // states
  const [query, setQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  // plane hooks
  const { t } = useTranslation();
  // store hooks

  const { side, align } = convertPlacementToSideAndAlign(placement ?? "bottom-start");
  // derived values
  const labelsList = labelIds.map((labelId) => getLabelById(labelId)).filter((label) => !!label);
  const filteredOptions =
    query === "" ? labelsList : labelsList?.filter((l) => l.name.toLowerCase().includes(query.toLowerCase()));

  const onOpen = () => {
    onDropdownOpen?.();
  };

  const dropdownOnChange = (val: string[]) => {
    onChange(val);
  };

  const { handleOpenChange } = useDropdown({ setIsOpen: setIsDropdownOpen, onOpen, setQuery });

  const searchInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    const q = query.trim();
    if (
      q !== "" &&
      e.key === "Enter" &&
      !e.nativeEvent.isComposing &&
      createLabelEnabled &&
      filteredOptions.length === 0 &&
      !submitting
    ) {
      e.preventDefault();
      await handleAddLabel(q);
    }
  };

  const handleAddLabel = async (labelName: string) => {
    if (!createLabel || submitting) return;
    const name = labelName.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      const existing = labelsList.find((l) => l.name.toLowerCase() === name.toLowerCase());
      const idToAdd = existing ? existing.id : (await createLabel({ name, color: getRandomLabelColor() })).id;
      onChange(Array.from(new Set([...value, idToAdd])));
      setQuery("");
    } catch (e) {
      console.error("Failed to create label", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div tabIndex={tabIndex} className="relative h-full flex-shrink-0">
      <Combobox.Root
        onOpenChange={handleOpenChange}
        open={isDropdownOpen}
        filter={null}
        value={value}
        onValueChange={dropdownOnChange}
        multiple
        disabled={disabled}
      >
        <Combobox.Trigger
          type="button"
          className={cn("flex h-full cursor-pointer items-center gap-2 text-11", buttonContainerClassName)}
        >
          {label ? (
            label
          ) : value && value.length > 0 ? (
            <span className={cn("flex h-full items-center justify-center gap-2 text-11", buttonClassName)}>
              <IssueLabelsList
                labels={value.map((v) => labelsList?.find((l) => l.id === v)) ?? []}
                length={3}
                showLength
              />
            </span>
          ) : (
            <div
              className={cn(
                "flex h-full items-center justify-center gap-1 rounded-sm border-[0.5px] border-strong px-2 py-1 text-11 hover:bg-layer-1",
                buttonClassName
              )}
            >
              <LabelPropertyIcon className="h-3 w-3 flex-shrink-0" />
              <span>{t("labels")}</span>
            </div>
          )}
        </Combobox.Trigger>

        {isDropdownOpen && (
          <Combobox.Portal>
            <Combobox.Positioner side={side} align={align} sideOffset={4} className="z-[120]">
              <Combobox.Popup data-prevent-outside-click>
                <div>
                  <div className="my-1 w-48 rounded-sm border-[0.5px] border-strong bg-surface-1 px-2 py-2.5 text-11 shadow-raised-200 focus:outline-none">
                    <div className="flex items-center gap-1.5 rounded-sm border border-subtle bg-surface-2 px-2">
                      <SearchIcon className="h-3.5 w-3.5 text-placeholder" strokeWidth={1.5} />
                      <Combobox.Input
                        className="w-full bg-transparent py-1 text-11 text-secondary placeholder:text-placeholder focus:outline-none"
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t("search")}
                        onKeyDown={searchInputKeyDown}
                      />
                    </div>
                    <Combobox.List className="mt-2 max-h-48 space-y-1 overflow-y-scroll">
                      {labelsList && filteredOptions ? (
                        filteredOptions.length > 0 ? (
                          filteredOptions.map((label) => {
                            const children = labelsList?.filter((l) => l.parent === label.id);

                            if (children.length === 0) {
                              if (!label.parent)
                                return (
                                  <Combobox.Item
                                    key={label.id}
                                    className={({ highlighted: active }) =>
                                      `${
                                        active ? "bg-layer-1" : ""
                                      } group flex w-full cursor-pointer items-center gap-2 truncate rounded-sm px-1 py-1.5 text-secondary select-none`
                                    }
                                    value={label.id}
                                    render={(itemProps, { selected }) => (
                                      <div {...itemProps}>
                                        {
                                          <div className="flex w-full justify-between gap-2 rounded-sm">
                                            <div className="flex items-center justify-start gap-2 truncate">
                                              <span
                                                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                                                style={{
                                                  backgroundColor: label.color,
                                                }}
                                              />
                                              <span className="truncate">{label.name}</span>
                                            </div>
                                            <div className="flex shrink-0 items-center justify-center rounded-sm p-1">
                                              <CheckIcon
                                                className={`h-3 w-3 ${selected ? "opacity-100" : "opacity-0"}`}
                                              />
                                            </div>
                                          </div>
                                        }
                                      </div>
                                    )}
                                  ></Combobox.Item>
                                );
                            } else
                              return (
                                <div key={label.id} className="border-y border-subtle">
                                  <div className="flex items-center gap-2 truncate p-2 text-primary select-none">
                                    <Component className="h-3 w-3" /> {label.name}
                                  </div>
                                  <div>
                                    {children.map((child) => (
                                      <Combobox.Item
                                        key={child.id}
                                        className={({ highlighted: active }) =>
                                          `${
                                            active ? "bg-layer-1" : ""
                                          } group flex min-w-[14rem] cursor-pointer items-center gap-2 truncate rounded-sm px-1 py-1.5 text-secondary select-none`
                                        }
                                        value={child.id}
                                        render={(itemProps, { selected }) => (
                                          <div {...itemProps}>
                                            {
                                              <div className="flex w-full justify-between gap-2 rounded-sm">
                                                <div className="flex items-center justify-start gap-2">
                                                  <span
                                                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                                                    style={{
                                                      backgroundColor: child?.color,
                                                    }}
                                                  />
                                                  <span>{child.name}</span>
                                                </div>
                                                <div className="flex items-center justify-center rounded-sm p-1">
                                                  <CheckIcon
                                                    className={`h-3 w-3 ${selected ? "opacity-100" : "opacity-0"}`}
                                                  />
                                                </div>
                                              </div>
                                            }
                                          </div>
                                        )}
                                      ></Combobox.Item>
                                    ))}
                                  </div>
                                </div>
                              );
                          })
                        ) : submitting ? (
                          <Loader className="h-3.5 w-3.5 animate-spin" />
                        ) : createLabelEnabled ? (
                          <p
                            onClick={() => {
                              if (!query.length) return;
                              handleAddLabel(query);
                            }}
                            className={`text-left text-secondary ${query.length ? "cursor-pointer" : "cursor-default"}`}
                          >
                            {/* TODO: translate here */}
                            {query.length ? (
                              <>
                                + Add <span className="text-primary">&quot;{query}&quot;</span> to labels
                              </>
                            ) : (
                              t("label.create.type")
                            )}
                          </p>
                        ) : (
                          <p className="px-1.5 py-1 text-placeholder italic">{t("no_matching_results")}</p>
                        )
                      ) : (
                        <p className="px-1.5 py-1 text-placeholder italic">{t("loading")}</p>
                      )}
                    </Combobox.List>
                  </div>
                </div>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        )}
      </Combobox.Root>
    </div>
  );
});
