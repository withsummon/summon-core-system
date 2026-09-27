import assert from "node:assert/strict";
import test from "node:test";
import { newPasswordError } from "../../account/auth-forms/password-validation.ts";

test("a strong password cannot create an account until its confirmation matches", () => {
  assert.equal(newPasswordError("Summon-Example9!", ""), "mismatch");
  assert.equal(newPasswordError("Summon-Example9!", "Summon-Example8!"), "mismatch");
  assert.equal(newPasswordError("Summon-Example9!", "Summon-Example9!"), null);
});

test("matching weak passwords retain the production signup strength requirement", () => {
  for (const password of ["", "Short1!", "longlowercase", "LongLettersOnly", "LettersAnd123"]) {
    assert.equal(newPasswordError(password, password), "strength");
  }
});
