import { isValidNextPath } from "@plane/utils";

/** Auth endpoints are owned by the caller; only local return paths may be forwarded. */
export function authReturnUrl(endpoint: string, returnPath: string | null): string {
  if (!returnPath || !isValidNextPath(returnPath)) return endpoint;
  return `${endpoint}?${new URLSearchParams({ next_path: returnPath.trim() })}`;
}
