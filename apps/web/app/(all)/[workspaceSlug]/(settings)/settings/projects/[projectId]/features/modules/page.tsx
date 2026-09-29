/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ProjectFeatureSettings } from "@/components/settings/project/content/feature-control-item";
import { FeaturesModulesProjectSettingsHeader } from "./header";

export { ProjectFeatureSettingsErrorBoundary as ErrorBoundary } from "@/components/settings/project/content/feature-control-item";

export default function FeaturesModulesSettingsPage() {
  return <ProjectFeatureSettings feature="modules" header={<FeaturesModulesProjectSettingsHeader />} />;
}
