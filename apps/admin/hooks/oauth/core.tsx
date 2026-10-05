/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { KeyRound, Mails } from "lucide-react";
import type { TGetAuthenticationModeProps } from "./types";
// assets
import giteaLogo from "@/app/assets/logos/gitea-logo.svg?url";
import githubLightModeImage from "@/app/assets/logos/github-black.png?url";
import githubDarkModeImage from "@/app/assets/logos/github-white.png?url";
import gitlabLogo from "@/app/assets/logos/gitlab-logo.svg?url";
import googleLogo from "@/app/assets/logos/google-logo.svg?url";
// components
import { EmailCodesConfiguration } from "@/components/authentication/email-config-switch";
import { GiteaConfiguration } from "@/components/authentication/gitea-config";
import { GithubConfiguration } from "@/components/authentication/github-config";
import { GitlabConfiguration } from "@/components/authentication/gitlab-config";
import { GoogleConfiguration } from "@/components/authentication/google-config";
import { PasswordLoginConfiguration } from "@/components/authentication/password-config-switch";

// Authentication methods
export const getCoreAuthenticationModesMap = ({
  disabled,
  updateConfig,
  resolvedTheme,
  configuration,
}: TGetAuthenticationModeProps) => ({
  "unique-codes": {
    key: "unique-codes",
    name: "Unique codes",
    description:
      "Log in or sign up for Plane using codes sent via email. You need to configure mail delivery to use this method.",
    icon: <Mails className="h-6 w-6 p-0.5 text-tertiary" />,
    config: <EmailCodesConfiguration disabled={disabled} updateConfig={updateConfig} configuration={configuration} />,
  },
  "passwords-login": {
    key: "passwords-login",
    name: "Passwords",
    description: "Allow members to create accounts with passwords and use it with their email addresses to sign in.",
    icon: <KeyRound className="h-6 w-6 p-0.5 text-tertiary" />,
    config: (
      <PasswordLoginConfiguration disabled={disabled} updateConfig={updateConfig} configuration={configuration} />
    ),
  },
  google: {
    key: "google",
    name: "Google",
    description: "Allow members to log in or sign up for Plane with their Google accounts.",
    icon: <img src={googleLogo} height={20} width={20} alt="Google Logo" />,
    config: <GoogleConfiguration disabled={disabled} updateConfig={updateConfig} configuration={configuration} />,
  },
  github: {
    key: "github",
    name: "GitHub",
    description: "Allow members to log in or sign up for Plane with their GitHub accounts.",
    icon: (
      <img
        src={resolvedTheme === "dark" ? githubDarkModeImage : githubLightModeImage}
        height={20}
        width={20}
        alt="GitHub Logo"
      />
    ),
    config: <GithubConfiguration disabled={disabled} updateConfig={updateConfig} configuration={configuration} />,
  },
  gitlab: {
    key: "gitlab",
    name: "GitLab",
    description: "Allow members to log in or sign up to plane with their GitLab accounts.",
    icon: <img src={gitlabLogo} height={20} width={20} alt="GitLab Logo" />,
    config: <GitlabConfiguration disabled={disabled} updateConfig={updateConfig} configuration={configuration} />,
  },
  gitea: {
    key: "gitea",
    name: "Gitea",
    description: "Allow members to log in or sign up to plane with their Gitea accounts.",
    icon: <img src={giteaLogo} height={20} width={20} alt="Gitea Logo" />,
    config: <GiteaConfiguration disabled={disabled} updateConfig={updateConfig} configuration={configuration} />,
  },
});
