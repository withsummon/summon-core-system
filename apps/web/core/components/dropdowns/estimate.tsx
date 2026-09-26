/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
// plane imports
import { useTranslation } from "@plane/i18n";
import { CheckIcon, SearchIcon, EstimatePropertyIcon, ChevronDownIcon } from "@plane/propel/icons";
import { EEstimateSystem } from "@plane/types";
import { ComboDropDown } from "@plane/ui";
import { convertMinutesToHoursMinutesString, cn } from "@plane/utils";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useEstimate } from "@/hooks/store/estimates/use-estimate";
import { useDropdown } from "@/hooks/use-dropdown";
// components
import { DropdownButton } from "./buttons";
import { BUTTON_VARIANTS_WITH_TEXT } from "./constants";
// types
import type { TDropdownProps } from "./types";

type Props = TDropdownProps & {
  button?: ReactNode;
  dropdownArrow?: boolean;
  dropdownArrowClassName?: string;
  onChange: (val: string | undefined) => void;
  onClose?: () => void;
  projectId: string | undefined;
  value: string | undefined | null;
  renderByDefault?: boolean;
};

type DropdownOptions =
  | {
      value: string | null;
      query: string;
      content: React.ReactNode;
    }[]
  | undefined;

export const EstimateDropdown = observer(function EstimateDropdown(props: Props) {
  const {
    button,
    buttonClassName,
    buttonContainerClassName,
    buttonVariant,
    className = "",
    disabled = false,
    dropdownArrow = false,
    dropdownArrowClassName = "",
    hideIcon = false,
    onChange,
    onClose,
    placeholder = "",
    placement,
    projectId,
    showTooltip = false,
    tabIndex,
    value,
    renderByDefault = true,
  } = props;
  // i18n
  const { t } = useTranslation();
  // states
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  // refs

  // router
  const { workspaceSlug } = useParams();
  // store hooks
  const { currentActiveEstimateIdByProjectId, getProjectEstimates, getEstimateById } = useProjectEstimates();
  const { estimatePointIds, estimatePointById } = useEstimate(
    projectId ? currentActiveEstimateIdByProjectId(projectId) : undefined
  );

  const currentActiveEstimateId = projectId ? currentActiveEstimateIdByProjectId(projectId) : undefined;

  const currentActiveEstimate = currentActiveEstimateId ? getEstimateById(currentActiveEstimateId) : undefined;

  const options: DropdownOptions = (estimatePointIds ?? [])
    ?.map((estimatePoint) => {
      const currentEstimatePoint = estimatePointById(estimatePoint);
      if (currentEstimatePoint)
        return {
          value: currentEstimatePoint.id,
          query: `${currentEstimatePoint?.value}`,
          content: (
            <div className="flex items-center gap-2">
              <EstimatePropertyIcon className="h-3 w-3 flex-shrink-0" />
              <span className="flex-grow truncate">
                {currentActiveEstimate?.type === EEstimateSystem.TIME
                  ? convertMinutesToHoursMinutesString(Number(currentEstimatePoint.value))
                  : currentEstimatePoint.value}
              </span>
            </div>
          ),
        };
      else undefined;
    })
    .filter((estimatePointDropdownOption) => estimatePointDropdownOption != undefined) as DropdownOptions;
  options?.unshift({
    value: null,
    query: t("project_settings.estimates.no_estimate"),
    content: (
      <div className="flex items-center gap-2">
        <EstimatePropertyIcon className="h-3 w-3 flex-shrink-0" />
        <span className="flex-grow truncate">{t("project_settings.estimates.no_estimate")}</span>
      </div>
    ),
  });

  const filteredOptions =
    query === "" ? options : options?.filter((o) => o.query.toLowerCase().includes(query.toLowerCase()));

  const selectedEstimate = value && estimatePointById ? estimatePointById(value) : undefined;

  const onOpen = async () => {
    if (!currentActiveEstimateId && workspaceSlug && projectId)
      await getProjectEstimates(workspaceSlug.toString(), projectId);
  };

  const { handleOpenChange } = useDropdown({ onClose, onOpen, setIsOpen, setQuery });

  const dropdownOnChange = (val: string | undefined) => {
    onChange(val);
  };

  const comboButton = button ? (
    <button
      type="button"
      className={cn("clickable block h-full w-full outline-none", buttonContainerClassName)}
      disabled={disabled}
    >
      {button}
    </button>
  ) : (
    <button
      type="button"
      className={cn(
        "clickable block h-full max-w-full outline-none",
        {
          "cursor-not-allowed text-secondary": disabled,
          "cursor-pointer": !disabled,
        },
        buttonContainerClassName
      )}
      disabled={disabled}
    >
      <DropdownButton
        className={buttonClassName}
        isActive={isOpen}
        tooltipHeading={t("project_settings.estimates.label")}
        tooltipContent={selectedEstimate ? selectedEstimate?.value : placeholder}
        showTooltip={showTooltip}
        variant={buttonVariant}
        renderToolTipByDefault={renderByDefault}
      >
        {!hideIcon && <EstimatePropertyIcon className="h-3 w-3 flex-shrink-0" />}
        {(selectedEstimate || placeholder) && BUTTON_VARIANTS_WITH_TEXT.includes(buttonVariant) && (
          <span className="truncate">
            {selectedEstimate ? (
              currentActiveEstimate?.type === EEstimateSystem.TIME ? (
                convertMinutesToHoursMinutesString(Number(selectedEstimate.value))
              ) : (
                selectedEstimate.value
              )
            ) : (
              <span className="text-placeholder">{placeholder}</span>
            )}
          </span>
        )}
        {dropdownArrow && (
          <ChevronDownIcon className={cn("h-2.5 w-2.5 flex-shrink-0", dropdownArrowClassName)} aria-hidden="true" />
        )}
      </DropdownButton>
    </button>
  );

  return (
    <ComboDropDown
      open={isOpen}
      tabIndex={tabIndex}
      className={cn("h-full w-full", className)}
      value={value}
      onChange={dropdownOnChange}
      disabled={disabled}
      button={comboButton}
      placement={placement}
      onOpenChange={handleOpenChange}
    >
      {isOpen && (
        <div className="z-10">
          <div className="my-1 w-48 rounded-sm border-[0.5px] border-strong bg-surface-1 px-2 py-2.5 text-11 shadow-raised-200 focus:outline-none">
            <div className="flex items-center gap-1.5 rounded-sm border border-subtle bg-surface-2 px-2">
              <SearchIcon className="h-3.5 w-3.5 text-placeholder" strokeWidth={1.5} />
              <Combobox.Input
                className="w-full bg-transparent py-1 text-11 text-secondary placeholder:text-placeholder focus:outline-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.search.placeholder")}
              />
            </div>
            <Combobox.List className="mt-2 max-h-48 space-y-1 overflow-y-scroll">
              {currentActiveEstimateId === undefined ? (
                <div
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 truncate rounded-sm px-1 py-1.5 text-secondary select-none`}
                >
                  {/* NOTE: This condition renders when estimates are not enabled for the project */}
                  <div className="flex flex-grow items-center gap-2">
                    <EstimatePropertyIcon className="h-3 w-3 flex-shrink-0" />
                    <span className="flex-grow truncate">{t("project_settings.estimates.no_estimate")}</span>
                  </div>
                </div>
              ) : (
                <>
                  {filteredOptions ? (
                    filteredOptions.length > 0 ? (
                      filteredOptions.map((option) => (
                        <Combobox.Item
                          key={option.value}
                          value={option.value}
                          render={(itemProps, { highlighted: active, selected }) => (
                            <div {...itemProps}>
                              {
                                <div
                                  className={cn(
                                    "flex w-full cursor-pointer items-center justify-between gap-2 truncate rounded-sm px-1 py-1.5 select-none",
                                    {
                                      "bg-layer-transparent-hover": active,
                                      "text-primary": selected,
                                      "text-secondary": !selected,
                                    }
                                  )}
                                >
                                  <span className="flex-grow truncate">{option.content}</span>
                                  {selected && <CheckIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                                </div>
                              }
                            </div>
                          )}
                        ></Combobox.Item>
                      ))
                    ) : (
                      <p className="px-1.5 py-1 text-placeholder italic">{t("common.search.no_matching_results")}</p>
                    )
                  ) : (
                    <p className="px-1.5 py-1 text-placeholder italic">{t("common.loading")}</p>
                  )}
                </>
              )}
            </Combobox.List>
          </div>
        </div>
      )}
    </ComboDropDown>
  );
});
