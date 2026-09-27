import type { AuthConfig } from "convex/server";

/** Public verification material is captured in the deployed auth configuration. */
export function nativeAuthConfig(issuer: string | undefined, publicJwks: string | undefined): AuthConfig {
  if (!issuer || !publicJwks) throw new Error("CONVEX_SITE_URL and public JWKS are required.");
  return {
    providers: [
      {
        type: "customJwt",
        issuer,
        applicationID: "convex",
        algorithm: "RS256",
        jwks: `data:application/json,${encodeURIComponent(publicJwks)}`,
      },
    ],
  };
}
