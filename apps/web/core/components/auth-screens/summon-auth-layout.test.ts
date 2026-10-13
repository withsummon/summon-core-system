import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Summon sign-in is Google-first and invite-only, on Plane authentication", () => {
  const authRoot = readFileSync(new URL("../account/auth-forms/auth-root.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(authRoot, /fetch\(|axios\.|summonService/);
  // Access is granted by invite, so the card offers no sign-up path.
  assert.doesNotMatch(authRoot, /\/sign-up/);
  // Email and password exist only where the instance enables them (local and staging).
  assert.match(authRoot, /is_email_password_enabled/);
  // The denied state's email is dropped from the address bar after it is read.
  assert.match(authRoot, /history\.replaceState/);
});
