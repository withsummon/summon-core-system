import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the source extension.
import { shouldWaitForProjectDetails } from "./project-details-gate.ts";

const firstVisit = {
  isParentLoading: false,
  isProjectDetailsLoading: true,
  hasProjectDetailsError: false,
  isProjectInStore: true,
  hasPermissionToCurrentProject: true,
};

test("renders a stored project the user may open while its details load", () => {
  assert.equal(shouldWaitForProjectDetails(firstVisit), false);
});

test("waits for details when the project is not in the store yet", () => {
  assert.equal(shouldWaitForProjectDetails({ ...firstVisit, isProjectInStore: false }), true);
});

test("waits for details before deciding access when the role does not grant it yet", () => {
  assert.equal(shouldWaitForProjectDetails({ ...firstVisit, hasPermissionToCurrentProject: false }), true);
});

test("waits while the parent wrapper is still loading", () => {
  assert.equal(shouldWaitForProjectDetails({ ...firstVisit, isParentLoading: true }), true);
});

test("stops waiting once details settle or fail", () => {
  const unknownProject = { ...firstVisit, isProjectInStore: false, hasPermissionToCurrentProject: false };
  assert.equal(shouldWaitForProjectDetails({ ...unknownProject, isProjectDetailsLoading: false }), false);
  assert.equal(shouldWaitForProjectDetails({ ...unknownProject, hasProjectDetailsError: true }), false);
});
