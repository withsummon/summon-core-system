import assert from "node:assert/strict";
import test from "node:test";
import { authFlowEnabled } from "../auth-policy.ts";

const password = {
  passwordSignIn: true,
  passwordReset: true,
  emailVerification: true,
  magicCode: false,
  unavailableReason: null,
};

test("password policy revocation closes every password flow including an already open verification", () => {
  for (const flow of ["signIn", "signUp", "reset", "reset-verification", "email-verification"] as const) {
    assert.equal(authFlowEnabled(flow, password), true);
    assert.equal(authFlowEnabled(flow, { ...password, passwordSignIn: false }), false);
  }
});

test("magic-only authentication remains usable without password recovery", () => {
  const magic = { ...password, passwordSignIn: false, passwordReset: false, emailVerification: false, magicCode: true };
  assert.equal(authFlowEnabled("magic", magic), true);
  assert.equal(authFlowEnabled("magic-verification", magic), true);
  assert.equal(authFlowEnabled("reset", magic), false);
  assert.equal(authFlowEnabled("magic-verification", { ...magic, magicCode: false }), false);
});
