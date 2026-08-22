export function isSummonWorkspacePath(pathname: string) {
  return /^\/[^/]+\/summon(?:\/|$)/.test(pathname);
}
