import assert from "node:assert/strict";
import test from "node:test";
import { retainedChoices } from "../choices.ts";

test("a new draft selection remains removable after its live option disappears", () => {
  const selected = ["new-label"];
  assert.deepEqual(retainedChoices([{ id: "new-label", label: "Follow up" }], [], selected, "Unavailable label"), [
    { id: "new-label", label: "Follow up" },
  ]);
  const choices = retainedChoices([], [], selected, "Unavailable label");
  assert.deepEqual(choices, [{ id: "new-label", label: "Unavailable label" }]);
  const unchecked = choices[0].id;
  const nextDraft = selected.filter((id) => id !== unchecked);
  assert.deepEqual(nextDraft, []);
  assert.deepEqual(retainedChoices([], [], nextDraft, "Unavailable label"), []);
});

test("live names win and shared assignee/creator selections do not duplicate", () => {
  assert.deepEqual(
    retainedChoices(
      [{ id: "member", label: "Current name" }],
      [
        { id: "member", name: "Saved name" },
        { id: "former", name: "Former member" },
      ],
      ["member", "member", "revoked", "revoked"],
      "Unavailable member"
    ),
    [
      { id: "member", label: "Current name" },
      { id: "former", label: "Former member" },
      { id: "revoked", label: "Unavailable member" },
    ]
  );
});
