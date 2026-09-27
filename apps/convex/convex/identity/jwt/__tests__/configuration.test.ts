import { expect, test } from "vitest";
import { nativeAuthConfig } from "../../../../shared/jwt-provider";
const issuer = "http://127.0.0.1:3211";
const oldKeys = JSON.stringify({ keys: [{ kty: "RSA", n: "old-public-modulus", e: "AQAB" }] });
test("native JWT verification retains issuer/audience/algorithm and reads only inline public JWKS", () => {
  expect(nativeAuthConfig(issuer, oldKeys)).toEqual({
    providers: [
      {
        type: "customJwt",
        issuer,
        applicationID: "convex",
        algorithm: "RS256",
        jwks: `data:application/json,${encodeURIComponent(oldKeys)}`,
      },
    ],
  });
});
test("rotation requires rebuilding the deployed config and does not mutate its prior key snapshot", () => {
  const old = nativeAuthConfig(issuer, oldKeys);
  const rotatedKeys = JSON.stringify({ keys: [{ kty: "RSA", n: "new-public-modulus", e: "AQAB" }] });
  const next = nativeAuthConfig(issuer, rotatedKeys);
  expect(next.providers[0]).not.toEqual(old.providers[0]);
  expect(old.providers[0]).toMatchObject({ jwks: `data:application/json,${encodeURIComponent(oldKeys)}` });
  expect(next.providers[0]).toMatchObject({
    issuer,
    applicationID: "convex",
    algorithm: "RS256",
    jwks: `data:application/json,${encodeURIComponent(rotatedKeys)}`,
  });
});
test("missing deployment material never falls back to network discovery or unauthenticated acceptance", () => {
  expect(() => nativeAuthConfig(undefined, oldKeys)).toThrow("required");
  expect(() => nativeAuthConfig(issuer, undefined)).toThrow("required");
});
