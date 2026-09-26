import assert from "node:assert/strict";
import { test } from "node:test";
import { associationOptions, selectedAssociation } from "../associations.ts";
test("an existing association outside the first option page remains preserved", () => {
  const options = associationOptions([{ id: "first", name: "First" }], "later", "Later");
  assert.equal(selectedAssociation("later", options), "later");
  assert.equal(options.length, 2);
});
test("unknown raw IDs cannot become mutation associations", () => {
  assert.throws(() => selectedAssociation("untrusted", [{ id: "known" }]));
  assert.equal(selectedAssociation("", [{ id: "known" }]), null);
});
test("loading the canonical association does not duplicate its option", () => {
  assert.deepEqual(associationOptions([{ id: "same", name: "Fresh label" }], "same", "Old label"), [
    { id: "same", name: "Fresh label" },
  ]);
});
