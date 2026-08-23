import assert from "node:assert/strict";
import test from "node:test";

import { IssueService } from "./issue.service";

test("IssueService accepts its optional query argument", async () => {
  const service = new IssueService();
  service.get = async () => ({ data: { results: [] } }) as never;

  await assert.doesNotReject(() => service.getIssues("core", "project"));
});
