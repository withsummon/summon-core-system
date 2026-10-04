/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { ESTIMATE_SYSTEMS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";

export function EstimateCreateStageOne({
  estimateSystem,
  types,
  onTypeChange,
  onTemplate,
}: {
  estimateSystem: FunctionArgs<typeof api.estimates.index.create>["type"];
  types: FunctionReturnType<typeof api.estimates.index.list>["types"];
  onTypeChange: (type: FunctionArgs<typeof api.estimates.index.create>["type"]) => void;
  onTemplate: (points: FunctionArgs<typeof api.estimates.index.create>["points"]) => void;
}) {
  const { t } = useTranslation();
  const system = ESTIMATE_SYSTEMS[estimateSystem];
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-1.5 text-13 font-medium text-secondary">
          {t("project_settings.estimates.create.choose_estimate_system")}
        </legend>
        <div className="flex flex-wrap gap-14">
          {types.map((type) => (
            <label key={type} className="flex items-center gap-1.5 text-14">
              <input
                type="radio"
                name="estimate-system"
                checked={estimateSystem === type}
                onChange={() => onTypeChange(type)}
              />
              {t(ESTIMATE_SYSTEMS[type].i18n_name)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <p className="text-13 font-medium text-secondary">
          {t("project_settings.estimates.create.start_from_scratch")}
        </p>
        <button
          type="button"
          className="block w-full space-y-1 rounded-md border border-subtle p-3 py-2.5 text-left hover:bg-layer-transparent-hover"
          onClick={() => onTemplate(system.templates.custom.values)}
        >
          <p className="text-14 font-medium">{t("project_settings.estimates.create.custom")}</p>
          <p className="text-11 text-tertiary">
            Add your own <span className="lowercase">{system.name}</span> from scratch.
          </p>
        </button>
      </div>
      <div className="space-y-1.5">
        <p className="text-13 font-medium text-secondary">{t("project_settings.estimates.create.choose_template")}</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Object.entries(system.templates)
            .filter(([, template]) => !template.hide)
            .map(([name, template]) => (
              <button
                key={name}
                type="button"
                className="space-y-1 rounded-md border border-subtle p-3 py-2.5 text-left hover:bg-surface-2"
                onClick={() => onTemplate(template.values)}
              >
                <p className="text-14 font-medium">{template.title}</p>
                <p className="text-11 text-tertiary">{template.values.map((point) => point.value).join(", ")}</p>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
