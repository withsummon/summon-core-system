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
import {
  POPUP_CLASSNAME,
  POPUP_OPTION_CLASSNAME,
  POPUP_SEARCH_CLASSNAME,
  POPUP_SEARCH_INPUT_CLASSNAME,
} from "@plane/propel/popover";
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
    label: buttonLabel,
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
  const labelsList = labelIds.map((labelId) => getLabelById(labelId)).filter((item) => !!item);
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
          {buttonLabel ? (
            buttonLabel
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

        <Combobox.Portal>
          <Combobox.Positioner side={side} align={align} sideOffset={4} className="z-[120]">
            <Combobox.Popup data-prevent-outside-click className={POPUP_CLASSNAME}>
              <div>
                <div className="w-56 max-w-[calc(100vw-2rem)]">
                  <div className={POPUP_SEARCH_CLASSNAME}>
                    <SearchIcon className="size-3.5 flex-none" />
                    <Combobox.Input
                      className={POPUP_SEARCH_INPUT_CLASSNAME}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t("search")}
                      onKeyDown={searchInputKeyDown}
                    />
                  </div>
                  <Combobox.List className="max-h-60 overflow-y-auto">
                    <LabelSelectOptions
                      labelsList={labelsList}
                      filteredOptions={filteredOptions}
                      submitting={submitting}
                      createLabelEnabled={createLabelEnabled}
                      query={query}
                      onAddLabel={(labelName) => void handleAddLabel(labelName)}
                    />
                  </Combobox.List>
                </div>
              </div>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
});

type TLabelSelectOptionsProps = {
  labelsList: IIssueLabel[];
  filteredOptions: IIssueLabel[];
  submitting: boolean;
  createLabelEnabled: boolean;
  query: string;
  onAddLabel: (labelName: string) => void;
};

function LabelSelectOptions(props: TLabelSelectOptionsProps) {
  const { labelsList, filteredOptions, submitting, createLabelEnabled, query, onAddLabel } = props;
  const { t } = useTranslation();

  if (!labelsList || !filteredOptions) return <p className="px-2 py-1.5 text-placeholder">{t("loading")}</p>;

  if (filteredOptions.length > 0)
    return (
      <>
        {filteredOptions.map((label) => {
          const children = labelsList.filter((l) => l.parent === label.id);

          if (children.length > 0) return <LabelGroupOption key={label.id} label={label} childLabels={children} />;
          // child labels render inside their parent's group
          if (label.parent) return null;
          return (
            <Combobox.Item
              key={label.id}
              className={POPUP_OPTION_CLASSNAME}
              value={label.id}
              render={(itemProps, { selected }) => (
                <div {...itemProps}>
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
                      <CheckIcon className={`h-3 w-3 ${selected ? "opacity-100" : "opacity-0"}`} />
                    </div>
                  </div>
                </div>
              )}
            ></Combobox.Item>
          );
        })}
      </>
    );

  if (submitting) return <Loader className="h-3.5 w-3.5 animate-spin" />;

  if (createLabelEnabled)
    return (
      <button
        type="button"
        disabled={!query.length}
        onClick={() => onAddLabel(query)}
        className={POPUP_OPTION_CLASSNAME}
      >
        {/* TODO: translate here */}
        {query.length ? (
          <>
            + Add <span className="text-primary">&quot;{query}&quot;</span> to labels
          </>
        ) : (
          t("label.create.type")
        )}
      </button>
    );

  return <p className="px-2 py-1.5 text-placeholder">{t("no_matching_results")}</p>;
}

function LabelGroupOption({ label, childLabels }: { label: IIssueLabel; childLabels: IIssueLabel[] }) {
  return (
    <div className="border-y border-subtle">
      <div className="flex items-center gap-2 truncate p-2 text-primary select-none">
        <Component className="h-3 w-3" /> {label.name}
      </div>
      <div>
        {childLabels.map((child) => (
          <Combobox.Item
            key={child.id}
            className={POPUP_OPTION_CLASSNAME}
            value={child.id}
            render={(itemProps, { selected }) => (
              <div {...itemProps}>
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
                    <CheckIcon className={`h-3 w-3 ${selected ? "opacity-100" : "opacity-0"}`} />
                  </div>
                </div>
              </div>
            )}
          ></Combobox.Item>
        ))}
      </div>
    </div>
  );
}
