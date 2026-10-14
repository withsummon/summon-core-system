/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { ChevronDown, FileText, FileSpreadsheet, Presentation, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@plane/utils";
import type { TDocumentFormat } from "./types";

const STEP_BADGE_CLASS =
  "flex size-4 items-center justify-center rounded-full bg-accent-primary text-[10px] font-bold text-on-color";

type TStepHeaderProps = {
  step: number;
  title: string;
  /** Id of the control this step labels; omit for steps that group several controls. */
  htmlFor?: string;
  className?: string;
};

export function StepHeader({ step, title, htmlFor, className = "mb-1.5" }: TStepHeaderProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={STEP_BADGE_CLASS}>{step}</span>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-xs font-semibold text-primary">
          {title}
        </label>
      ) : (
        <span className="text-xs font-semibold text-primary">{title}</span>
      )}
    </div>
  );
}

const FORMAT_OPTIONS: { value: TDocumentFormat; icon: LucideIcon; activeClass: string; idleClass: string }[] = [
  { value: "DOCX", icon: FileText, activeClass: "text-label-indigo-text", idleClass: "text-label-indigo-icon" },
  { value: "PDF", icon: FileSpreadsheet, activeClass: "text-label-crimson-text", idleClass: "text-label-crimson-icon" },
  { value: "PPTX", icon: Presentation, activeClass: "text-label-orange-text", idleClass: "text-label-orange-icon" },
];

type TFormatPickerProps = {
  value: TDocumentFormat;
  onChange: (format: TDocumentFormat) => void;
};

export function FormatPicker({ value, onChange }: TFormatPickerProps) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-medium text-secondary">Document Format</span>
      <div className="grid grid-cols-3 gap-2">
        {FORMAT_OPTIONS.map(({ value: option, icon: Icon, activeClass, idleClass }) => {
          const isActive = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-[background-color,border-color,color,box-shadow]",
                isActive
                  ? "border-accent-strong bg-accent-subtle text-accent-primary shadow-xs"
                  : "border-subtle bg-surface-2 text-secondary hover:border-strong hover:text-primary"
              )}
            >
              <Icon size={14} className={isActive ? activeClass : idleClass} />
              <span>{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type TMenuSelectProps<T extends string> = {
  id?: string;
  isOpen: boolean;
  onToggle: () => void;
  value: T;
  options: readonly T[];
  onSelect: (value: T) => void;
  buttonContent: ReactNode;
  buttonClassName: string;
  menuClassName?: string;
  optionClassName?: string;
  checkSize?: number;
  checkClassName?: string;
  renderOption?: (option: T) => ReactNode;
};

/** Button that toggles an absolutely positioned single-select option list. */
export function MenuSelect<T extends string>({
  id,
  isOpen,
  onToggle,
  value,
  options,
  onSelect,
  buttonContent,
  buttonClassName,
  menuClassName,
  optionClassName = "py-1.5",
  checkSize = 12,
  checkClassName,
  renderOption = (option) => <span>{option}</span>,
}: TMenuSelectProps<T>) {
  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-subtle bg-surface-2 px-3 text-xs text-primary transition-colors hover:border-strong",
          buttonClassName
        )}
      >
        {buttonContent}
      </button>
      {isOpen && (
        <div
          className={cn(
            "absolute z-30 mt-1 w-full rounded-lg border border-subtle bg-surface-1 py-1 shadow-lg",
            menuClassName
          )}
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={cn(
                "flex w-full items-center justify-between px-3 text-left text-xs transition-colors hover:bg-surface-2",
                optionClassName,
                value === option && "bg-accent-subtle font-medium text-accent-primary"
              )}
            >
              {renderOption(option)}
              {value === option && <Check size={checkSize} className={cn("text-accent-primary", checkClassName)} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SelectChevron({ size = 13, className }: { size?: number; className?: string }) {
  return <ChevronDown size={size} className={cn("text-placeholder", className)} />;
}
