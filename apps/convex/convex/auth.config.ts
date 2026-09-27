import { nativeAuthConfig } from "../shared/jwt-provider";
export default nativeAuthConfig(process.env.CONVEX_SITE_URL, process.env.JWKS);
