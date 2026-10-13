/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { CloseIcon, ModuleIcon, ChevronDownIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
// hooks
import { useModule } from "@/hooks/store/use-module";
import { usePlatformOS } from "@/hooks/use-platform-os";

type ModuleButtonContentProps = {
  disabled: boolean;
  dropdownArrow: boolean;
  dropdownArrowClassName: string;
  hideIcon: boolean;
  hideText: boolean;
  onChange: (moduleIds: string[]) => void;
  placeholder?: string;
  showCount: boolean;
  showTooltip?: boolean;
  value: string | string[] | null;
  className?: string;
};

function getModuleCountLabel(moduleIds: string[], firstModuleName: string | undefined, placeholder?: string) {
  if (moduleIds.length === 0) return placeholder;
  if (moduleIds.length === 1) return `${firstModuleName || "module"}`;
  return `${moduleIds.length} Modules`;
}

type TModuleChipProps = {
  moduleName: string | undefined;
  className?: string;
  hideIcon: boolean;
  hideText: boolean;
  showTooltip: boolean;
  isMobile: boolean;
  /** Omitted when the dropdown is disabled. */
  onRemove?: () => void;
};

function ModuleChip(props: TModuleChipProps) {
  const { moduleName, className, hideIcon, hideText, showTooltip, isMobile, onRemove } = props;
  return (
    <div className={cn("flex max-w-full items-center gap-1 rounded-sm bg-layer-1 py-1 text-secondary", className)}>
      {!hideIcon && <ModuleIcon className="h-2.5 w-2.5 flex-shrink-0" />}
      {!hideText && (
        <Tooltip
          tooltipHeading="Title"
          tooltipContent={moduleName}
          disabled={!showTooltip}
          isMobile={isMobile}
          renderByDefault={false}
        >
          <span className="max-w-40 truncate text-11 font-medium">{moduleName}</span>
        </Tooltip>
      )}
      {onRemove && (
        <Tooltip tooltipContent="Remove" disabled={!showTooltip} isMobile={isMobile} renderByDefault={false}>
          <button
            type="button"
            className="flex-shrink-0"
            aria-label={`Remove ${moduleName ?? "module"}`}
            onClick={onRemove}
          >
            <CloseIcon className="h-2.5 w-2.5 text-tertiary hover:text-danger-primary" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

function MultiModuleValue(props: ModuleButtonContentProps & { value: string[] }) {
  const {
    disabled,
    hideIcon,
    hideText,
    onChange,
    placeholder,
    showCount,
    showTooltip = false,
    value,
    className,
  } = props;
  // store hooks
  const { getModuleById } = useModule();
  const { isMobile } = usePlatformOS();

  if (showCount)
    return (
      <div className="relative flex max-w-full items-center gap-1">
        {!hideIcon && <ModuleIcon className="h-3 w-3 flex-shrink-0" />}
        {(value.length > 0 || !!placeholder) && (
          <div className="max-w-40 truncate">
            {getModuleCountLabel(value, getModuleById(value[0])?.name, placeholder)}
          </div>
        )}
      </div>
    );

  if (value.length === 0)
    return (
      <>
        {!hideIcon && <ModuleIcon className="h-3 w-3 flex-shrink-0" />}
        <span className="flex-grow truncate text-left">{placeholder}</span>
      </>
    );

  return (
    <div className="flex max-w-full flex-grow flex-wrap items-center gap-2 truncate py-0.5">
      {value.map((moduleId) => (
        <ModuleChip
          key={moduleId}
          moduleName={getModuleById(moduleId)?.name}
          className={className}
          hideIcon={hideIcon}
          hideText={hideText}
          showTooltip={showTooltip}
          isMobile={isMobile}
          onRemove={disabled ? undefined : () => onChange(value.filter((m) => m !== moduleId))}
        />
      ))}
    </div>
  );
}

function SingleModuleValue(props: ModuleButtonContentProps & { value: string | null }) {
  const { hideIcon, hideText, placeholder, value } = props;
  // store hooks
  const { getModuleById } = useModule();

  return (
    <>
      {!hideIcon && <ModuleIcon className="h-3 w-3 flex-shrink-0" />}
      {!hideText && (
        <span className="flex-grow truncate text-left">{value ? getModuleById(value)?.name : placeholder}</span>
      )}
    </>
  );
}

export function ModuleButtonContent(props: ModuleButtonContentProps) {
  const { dropdownArrow, dropdownArrowClassName, value } = props;

  return (
    <>
      {Array.isArray(value) ? (
        <MultiModuleValue {...props} value={value} />
      ) : (
        <SingleModuleValue {...props} value={value} />
      )}
      {dropdownArrow && (
        <ChevronDownIcon className={cn("h-2.5 w-2.5 flex-shrink-0", dropdownArrowClassName)} aria-hidden="true" />
      )}
    </>
  );
}
