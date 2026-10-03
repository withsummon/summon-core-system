export type CsvOptions = { formulaProtection?: "none" | "text" };
/** RFC 4180 encoding preserves values by default (including credential bytes).
 * Report callers opt into literal formula text; plain decimal amounts stay numeric.
 */
export function serializeCsv(rows: ReadonlyArray<ReadonlyArray<string>>, options: CsvOptions = {}) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const formulaText = /^[\s]*[=+\-@]/.test(value) && !/^[+-]?\d+(?:\.\d+)?$/.test(value);
          const safe = options.formulaProtection === "text" && formulaText ? `'${value}` : value;
          return `"${safe.replaceAll('"', '""')}"`;
        })
        .join(",")
    )
    .join("\r\n");
}
