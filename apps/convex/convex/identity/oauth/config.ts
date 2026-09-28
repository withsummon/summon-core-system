export const oauthProviderIds = ["google", "github", "gitlab", "gitea"] as const;
export const providerNames = { google: "Google", github: "GitHub", gitlab: "GitLab", gitea: "Gitea" } as const;
export function oauthConfigurations(env: Record<string, string | undefined>) {
  return oauthProviderIds.flatMap((id) => {
    const prefix = id.toUpperCase();
    const clientId = env[`${prefix}_CLIENT_ID`];
    const clientSecret = env[`${prefix}_CLIENT_SECRET`];
    if (!clientId || !clientSecret) return [];
    const rawHost =
      id === "gitlab" ? (env.GITLAB_HOST ?? "https://gitlab.com") : id === "gitea" ? env.GITEA_HOST : undefined;
    let host: string | undefined;
    if (id === "gitlab" || id === "gitea") {
      if (!rawHost) return [];
      try {
        const url = new URL(rawHost);
        if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/")
          return [];
        host = url.origin;
      } catch {
        return [];
      }
    }
    const organization = id === "github" ? env.GITHUB_ORGANIZATION_ID : undefined;
    if (organization && !/^[a-zA-Z0-9-]+$/.test(organization)) return [];
    return [{ id, clientId, clientSecret, host, organization }];
  });
}
