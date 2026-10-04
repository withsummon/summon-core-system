/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// types
import { useTranslation } from "@plane/i18n";

type Props = {
  value: "all" | "individual";
  onChange: (value: Props["value"]) => void;
};

const WEBHOOK_EVENT_TYPES: { key: Props["value"]; i18n_label: string }[] = [
  {
    key: "all",
    i18n_label: "workspace_settings.settings.webhooks.options.all",
  },
  {
    key: "individual",
    i18n_label: "workspace_settings.settings.webhooks.options.individual",
  },
];

export function WebhookOptions(props: Props) {
  const { value, onChange } = props;
  const { t } = useTranslation();

  return (
    <fieldset>
      <legend className="text-13 font-medium">{t("workspace_settings.settings.webhooks.modal.question")}</legend>
      <div className="space-y-3">
        {WEBHOOK_EVENT_TYPES.map((option) => (
          <div key={option.key} className="flex items-center gap-2">
            <input
              id={option.key}
              type="radio"
              name="webhook-event-mode"
              value={option.key}
              checked={value == option.key}
              onChange={() => onChange(option.key)}
            />
            <label className="text-13" htmlFor={option.key}>
              {t(option.i18n_label)}
            </label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
