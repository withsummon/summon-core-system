import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("./money.ts", import.meta.url), "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
  }).outputText
).toString("base64")}`;
// SAFETY: The loaded module is a direct TypeScript transpilation of money.ts above.
const model = (await import(moduleUrl)) as typeof import("./money");
const { formatMoney } = model;

test("Rupiah uses the official notation", () => {
  assert.equal(formatMoney("6247545000.00"), "Rp6.247.545.000,00");
  assert.equal(formatMoney("1500"), "Rp1.500,00");
  assert.equal(formatMoney("0.5"), "Rp0,50");
  assert.equal(formatMoney("-1250000.75"), "-Rp1.250.000,75");
});

test("amounts beyond float precision stay exact", () => {
  assert.equal(formatMoney("12345678901234567890.12"), "Rp12.345.678.901.234.567.890,12");
});

test("other currencies keep the grouping with their own prefix", () => {
  assert.equal(formatMoney("2500.00", "USD"), "US$2.500,00");
  assert.equal(formatMoney("2500", "sgd"), "SGD 2.500,00");
});

test("empty and non-decimal values pass through", () => {
  assert.equal(formatMoney(null), "");
  assert.equal(formatMoney(""), "");
  assert.equal(formatMoney("TBD"), "TBD");
});

test("typed money regroups and keeps an unfinished comma", () => {
  const { groupMoneyText } = model;
  assert.equal(groupMoneyText("1500000"), "1.500.000");
  assert.equal(groupMoneyText("1.500000"), "1.500.000");
  assert.equal(groupMoneyText("1.50.000"), "150.000");
  assert.equal(groupMoneyText("1500000,"), "1.500.000,");
  assert.equal(groupMoneyText("1500000,5"), "1.500.000,5");
  assert.equal(groupMoneyText("007"), "7");
  assert.equal(groupMoneyText(",5"), "0,5");
  assert.equal(groupMoneyText("Rp 2500"), "2.500");
  assert.equal(groupMoneyText(""), "");
});

test("typed money refuses letters, a third cents digit and a second comma", () => {
  const { groupMoneyText } = model;
  assert.equal(groupMoneyText("12a"), null);
  assert.equal(groupMoneyText("1,555"), null);
  assert.equal(groupMoneyText("1,5,5"), null);
});

test("typed money round-trips with the API decimal", () => {
  const { decimalToMoneyText, groupMoneyText, moneyTextToDecimal } = model;
  assert.equal(moneyTextToDecimal("1.500.000,5"), "1500000.5");
  assert.equal(moneyTextToDecimal("1.500.000,"), "1500000");
  assert.equal(moneyTextToDecimal(""), "");
  assert.equal(decimalToMoneyText("1500000.00"), "1.500.000,00");
  assert.equal(moneyTextToDecimal(decimalToMoneyText("6247545000.75") ?? ""), "6247545000.75");
  assert.equal(moneyTextToDecimal(groupMoneyText("12345678901234567890,12") ?? ""), "12345678901234567890.12");
});
