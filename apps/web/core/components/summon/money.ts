/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Money stays text end to end: the API sends decimal strings ("1500000.00") and every helper here
// works on the digits, so large amounts never pass through a float.

const CURRENCY_PREFIX: Record<string, string> = { IDR: "Rp", USD: "US$" };
const DECIMAL_TEXT = /^(-?)(\d+)(?:\.(\d+))?$/;
// Indonesian notation: dots group thousands, a comma starts at most two cents digits.
const MONEY_TEXT = /^([\d.]*)(?:,(\d{0,2}))?$/;

const groupThousands = (digits: string) =>
  (digits.replace(/^0+(?=\d)/, "") || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const currencyPrefix = (currency = "IDR") => {
  const code = currency.toUpperCase();
  return CURRENCY_PREFIX[code] ?? `${code} `;
};

/** Official money notation, e.g. "6247545000.00" → "Rp6.247.545.000,00". Text that is not a plain decimal is shown as-is. */
export function formatMoney(value: string | null | undefined, currency = "IDR"): string {
  if (!value) return "";
  const text = decimalToMoneyText(value);
  if (text === null) return value;
  const negative = text.startsWith("-");
  return `${negative ? "-" : ""}${currencyPrefix(currency)}${negative ? text.slice(1) : text}`;
}

/** API decimal → editable Indonesian text with two cents digits, e.g. "1500000" → "1.500.000,00"; null if not a decimal. */
export function decimalToMoneyText(value: string): string | null {
  const match = DECIMAL_TEXT.exec(value.trim());
  if (!match) return null;
  const [, sign, whole, fraction = ""] = match;
  return `${sign}${groupThousands(whole)},${fraction.padEnd(2, "0").slice(0, 2)}`;
}

/**
 * Regroup money text as it is typed: "1500000" → "1.500.000", "1.500000,5" → "1.500.000,5".
 * Keeps an unfinished comma so cents can be typed; returns null for text a money field must refuse.
 */
export function groupMoneyText(text: string): string | null {
  const raw = text.replace(/^\s*(?:Rp|US\$)/i, "").replace(/\s/g, "");
  if (!raw) return "";
  const match = MONEY_TEXT.exec(raw);
  if (!match) return null;
  const [, whole, cents] = match;
  return groupThousands(whole.replace(/\./g, "")) + (cents === undefined ? "" : `,${cents}`);
}

/** Editable Indonesian text → API decimal string: "1.500.000,5" → "1500000.5", "" → "". */
export function moneyTextToDecimal(text: string): string {
  return text.replace(/\./g, "").replace(",", ".").replace(/\.$/, "");
}
