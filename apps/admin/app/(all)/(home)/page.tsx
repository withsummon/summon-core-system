/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Route } from "./+types/page";
import { InstanceSignInForm } from "./sign-in-form";
function HomePage() {
  return <InstanceSignInForm />;
}
export default HomePage;

export const meta: Route.MetaFunction = () => [
  { title: "Admin – Sign-In" },
  { name: "description", content: "Sign in to the admin portal." },
];
