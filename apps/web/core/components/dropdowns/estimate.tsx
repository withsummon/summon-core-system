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
import { POPUP_OPTION_CLASSNAME, POPUP_SEARCH_CLASSNAME, POPUP_SEARCH_INPUT_CLASSNAME } from "@plane/propel/popover";
import { EEstimateSystem } from "@plane/types";
import type { IEstimatePoint } from "@plane/types";
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

function formatEstimateValue(value: string | number | undefined, estimateType: string | undefined) {
  return estimateType === EEstimateSystem.TIME ? convertMinutesToHoursMinutesString(Number(value)) : value;
}

function EstimateOptionContent({ label }: { label: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <EstimatePropertyIcon className="h-3 w-3 flex-shrink-0" />
      <span className="flex-grow truncate">{label}</span>
    </div>
  );
}

/** "No estimate" first, then every resolvable estimate point of the active estimate. */
function getEstimateOptions(
  estimatePointIds: string[],
  estimatePointById: (id: string) => IEstimatePoint | undefined,
  estimateType: string | undefined,
  noEstimateLabel: string
): NonNullable<DropdownOptions> {
  const pointOptions: NonNullable<DropdownOptions> = [];
  for (const estimatePointId of estimatePointIds) {
    const estimatePoint = estimatePointById(estimatePointId);
    if (!estimatePoint?.id) continue;
    pointOptions.push({
      value: estimatePoint.id,
      query: `${estimatePoint.value}`,
      content: <EstimateOptionContent label={formatEstimateValue(estimatePoint.value, estimateType)} />,
    });
  }
  return [
    { value: null, query: noEstimateLabel, content: <EstimateOptionContent label={noEstimateLabel} /> },
    ...pointOptions,
  ];
}

type TEstimateOptionsPanelProps = {
  query: string;
  onQueryChange: (query: string) => void;
  isEstimateEnabled: boolean;
  options: DropdownOptions;
};

function EstimateOptionsPanel({ query, onQueryChange, isEstimateEnabled, options }: TEstimateOptionsPanelProps) {
  const { t } = useTranslation();
  const filteredOptions =
    query === "" ? options : options?.filter((o) => o.query.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="z-10">
      <div className="w-56 max-w-[calc(100vw-2rem)]">
        <div className={POPUP_SEARCH_CLASSNAME}>
          <SearchIcon className="size-3.5 flex-none" />
          <Combobox.Input
            className={POPUP_SEARCH_INPUT_CLASSNAME}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("common.search.placeholder")}
          />
        </div>
        <Combobox.List className="max-h-60 overflow-y-auto">
          {!isEstimateEnabled ? (
            <div className={POPUP_OPTION_CLASSNAME}>
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
                      className={POPUP_OPTION_CLASSNAME}
                      render={(itemProps, { selected }) => (
                        <div {...itemProps}>
                          <span className="flex-grow truncate">{option.content}</span>
                          {selected && <CheckIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                        </div>
                      )}
                    ></Combobox.Item>
                  ))
                ) : (
                  <p className="px-2 py-1.5 text-placeholder">{t("common.search.no_matching_results")}</p>
                )
              ) : (
                <p className="px-2 py-1.5 text-placeholder">{t("common.loading")}</p>
              )}
            </>
          )}
        </Combobox.List>
      </div>
    </div>
  );
}

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

  const options = getEstimateOptions(
    estimatePointIds ?? [],
    estimatePointById,
    currentActiveEstimate?.type,
    t("project_settings.estimates.no_estimate")
  );

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
      className={cn(
        "clickable block h-full w-full outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid",
        buttonContainerClassName
      )}
      disabled={disabled}
    >
      {button}
    </button>
  ) : (
    <button
      type="button"
      className={cn(
        "clickable block h-full max-w-full outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid",
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
              formatEstimateValue(selectedEstimate.value, currentActiveEstimate?.type)
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
      <EstimateOptionsPanel
        query={query}
        onQueryChange={setQuery}
        isEstimateEnabled={currentActiveEstimateId !== undefined}
        options={options}
      />
    </ComboDropDown>
  );
});
