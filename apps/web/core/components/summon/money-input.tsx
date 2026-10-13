/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Input } from "@plane/propel/input";
import type { InputProps } from "@plane/propel/input";
import { cn } from "@plane/utils";
import { currencyPrefix, decimalToMoneyText, groupMoneyText, moneyTextToDecimal } from "./money";

type Props = Omit<InputProps, "value" | "defaultValue" | "onChange" | "type" | "inputMode"> & {
  /** API decimal string, e.g. "1500000.00". Omit with `defaultValue` for an uncontrolled field. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (decimal: string) => void;
  currency?: string;
};

/**
 * Money field that shows Indonesian grouping while typing ("1.500.000,50") and reports the API decimal
 * ("1500000.50"). With `name` it submits the decimal through a hidden input, so native forms get the API value.
 */
export function MoneyInput({ value, defaultValue, onValueChange, currency, name, className, ...rest }: Props) {
  const prefix = currencyPrefix(currency).trim();
  const [text, setText] = useState(() => toMoneyText(value ?? defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);
  // How many digits and commas sat left of the caret, so regrouping does not throw the caret to the end.
  const caretMarks = useRef<number | null>(null);

  // Follow outside changes (a reset or a refetch), but not the echo of what was just typed.
  useEffect(() => {
    if (value === undefined) return;
    setText((current) => (moneyTextToDecimal(current) === (value ?? "") ? current : toMoneyText(value)));
  }, [value]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (caretMarks.current === null || !input || document.activeElement !== input) return;
    const position = caretAfterMarks(text, caretMarks.current);
    input.setSelectionRange(position, position);
    caretMarks.current = null;
  }, [text]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = groupMoneyText(event.target.value);
    if (next === null) return;
    caretMarks.current = countMarks(event.target.value.slice(0, event.target.selectionStart ?? undefined));
    setText(next);
    onValueChange?.(moneyTextToDecimal(next));
  };

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-13 text-tertiary"
      >
        {prefix}
      </span>
      <Input
        {...rest}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={text}
        onChange={handleChange}
        className={cn("w-full tabular-nums", prefix.length > 2 ? "pl-12" : "pl-9", className)}
      />
      {name ? <input type="hidden" name={name} value={moneyTextToDecimal(text)} /> : null}
    </div>
  );
}

const toMoneyText = (value: string | null | undefined) => (value ? (decimalToMoneyText(value) ?? value) : "");

const countMarks = (text: string) => text.replace(/[^\d,]/g, "").length;

function caretAfterMarks(text: string, marks: number) {
  if (marks <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < text.length; index++) {
    if (/[\d,]/.test(text[index]) && ++seen === marks) return index + 1;
  }
  return text.length;
}
