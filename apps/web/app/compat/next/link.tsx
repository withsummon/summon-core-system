/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Link as RRLink } from "react-router";
import { ensureTrailingSlash, normalizeLinkPrefetch, type LinkPrefetch } from "./helper";

type NextLinkProps = Omit<React.ComponentProps<"a">, "href" | "prefetch"> & {
  href: string;
  replace?: boolean;
  prefetch?: LinkPrefetch;
  scroll?: boolean; // next.js prop, ignored
  shallow?: boolean; // next.js prop, ignored
};

// Forward the ref: primitives such as Base UI tabs measure and focus the rendered anchor.
const Link = React.forwardRef<HTMLAnchorElement, NextLinkProps>(function Link(
  { href, replace, prefetch, scroll: _scroll, shallow: _shallow, ...rest },
  ref
) {
  return (
    <RRLink
      ref={ref}
      to={ensureTrailingSlash(href)}
      replace={replace}
      prefetch={normalizeLinkPrefetch(prefetch)}
      {...rest}
    />
  );
});

export default Link;
