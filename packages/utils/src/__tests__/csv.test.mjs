import assert from "node:assert/strict";
import { test } from "node:test";
import { serializeCsv } from "../csv.ts";
test("CSV protects quotes, commas, newlines and URL fragments without changing row boundaries", () => {
  assert.equal(
    serializeCsv([
      ["Section", "Label", "Value"],
      ["Project health", 'Delivery, "North"\nPhase 2', "https://example.com/#section"],
    ]),
    '"Section","Label","Value"\r\n"Project health","Delivery, ""North""\nPhase 2","https://example.com/#section"'
  );
});
test("spreadsheet formula prefixes are literal even after leading whitespace", () => {
  for (const value of ["=1+1", "+SUM(A1)", "-1+2", "@SUM(A1)", ' \t\r\n=HYPERLINK("https://example.com")']) {
    assert.ok(serializeCsv([[value]], { formulaProtection: "text" }).startsWith("\"'"));
  }
});
test("existing secret export strings and exact decimal bytes are retained", () => {
  assert.equal(
    serializeCsv([["API key", "plane_api_secret", "10000000000000000.01"]]),
    '"API key","plane_api_secret","10000000000000000.01"'
  );
});

test("default credential export preserves exact leading formula-like bytes", () => {
  for (const value of ["+secret", "-secret", "=secret", "@secret"]) assert.equal(serializeCsv([[value]]), `"${value}"`);
});
test("report spreadsheet protection retains known decimal amounts as numeric cells", () => {
  assert.equal(
    serializeCsv([["-0.10", "10000000000000000.01", "-1+2"]], { formulaProtection: "text" }),
    '"-0.10","10000000000000000.01","\'-1+2"'
  );
});
