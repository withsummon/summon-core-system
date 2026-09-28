/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Link, useSearchParams } from "react-router";
import { AUTH_TRACKER_ELEMENTS, EAuthModes, SITE_TITLE } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { PageHead } from "@/components/core/page-title";

const authContentMap = {
  [EAuthModes.SIGN_IN]: {
    pageTitle: "Sign in",
    text: "auth.common.new_to_plane",
    linkText: "Sign up",
    linkHref: "/sign-up",
  },
  [EAuthModes.SIGN_UP]: {
    pageTitle: "Sign up",
    text: "auth.common.already_have_an_account",
    linkText: "Sign in",
    linkHref: "/",
  },
};

type AuthHeaderProps = {
  type: EAuthModes;
  enableSignUp?: boolean;
  pageTitle?: string;
};

export function AuthHeader({ type, enableSignUp, pageTitle }: AuthHeaderProps) {
  const { t } = useTranslation();
  const [params] = useSearchParams();

  return (
    <AuthHeaderBase
      pageTitle={t(pageTitle ?? authContentMap[type].pageTitle)}
      additionalAction={
        enableSignUp && (
          <div className="flex flex-col items-end text-center text-13 font-medium text-tertiary sm:flex-row sm:items-center sm:gap-2">
            <span className="text-body-sm-regular text-tertiary">{t(authContentMap[type].text)}</span>
            <Link
              data-ph-element={AUTH_TRACKER_ELEMENTS.NAVIGATE_TO_SIGN_UP}
              to={`${authContentMap[type].linkHref}?${params}`}
              className="text-body-sm-semibold text-accent-primary hover:underline"
            >
              {t(authContentMap[type].linkText)}
            </Link>
          </div>
        )
      }
    />
  );
}

type TAuthHeaderBase = {
  pageTitle: string;
  additionalAction?: React.ReactNode;
};

export function AuthHeaderBase(props: TAuthHeaderBase) {
  const { pageTitle, additionalAction } = props;
  return (
    <>
      <PageHead title={`${pageTitle} - ${SITE_TITLE}`} />
      <div className="flex w-full flex-shrink-0 items-center justify-between gap-6">
        <Link to="/" className="font-semibold text-primary lg:invisible">
          <span className="text-16 font-semibold text-primary">{SITE_TITLE}</span>
        </Link>
        {additionalAction}
      </div>
    </>
  );
}
