import assert from "node:assert/strict";
import test from "node:test";
import { authReturnUrl } from "../../../../helpers/auth-return.ts";

test("authentication preserves a complete local selection as one return parameter", () => {
  const selected = "/workspace/tasks?project=a&view=mine#comment-123";
  for (const endpoint of ["/", "https://api.example.test/auth/google/"]) {
    const request = new URL(authReturnUrl(endpoint, selected), "https://app.example.test");
    assert.equal(request.searchParams.get("next_path"), selected);
    assert.equal(request.searchParams.size, 1);
    assert.equal(request.hash, "");
  }
});

test("untrusted external or executable destinations are never forwarded to auth", () => {
  for (const target of ["//evil.example", "https://evil.example", "javascript:alert(1)", "/\\evil.example", null]) {
    assert.equal(authReturnUrl("/", target), "/");
  }
  assert.equal(
    new URL(authReturnUrl("/", " /workspace "), "https://app.example.test").searchParams.get("next_path"),
    "/workspace"
  );
});
