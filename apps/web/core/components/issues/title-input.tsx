/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useEffect, useCallback, useId, useMemo } from "react";
import debounce from "lodash-es/debounce";
import { useTranslation } from "@plane/i18n";
import type { TNameDescriptionLoader } from "@plane/types";
import { TextArea } from "@plane/ui";
import { Button } from "@plane/propel/button";
import { cn } from "@plane/utils";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { TextAutosave } from "@/components/editor/rich-text/description-input/autosave";

export type IssueTitleInputProps = {
  disabled?: boolean;
  value: string;
  onSubmit: (title: string) => Promise<string>;
  setIsSubmitting: (value: TNameDescriptionLoader) => void;
  className?: string;
  containerClassName?: string;
};

export function IssueTitleInput({
  disabled,
  value,
  onSubmit,
  setIsSubmitting,
  className,
  containerClassName,
}: IssueTitleInputProps) {
  const { t } = useTranslation();
  const id = useId();
  const [autosave] = useState(() => new TextAutosave(value, onSubmit));
  const [title, setTitle] = useState(value);
  const [isLengthVisible, setIsLengthVisible] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (autosave.receive(value)) setTitle(value);
  }, [autosave, value, title]);
  const save = useCallback(
    async (retry = false) => {
      if (!autosave.dirty && !autosave.saving && !retry) return;
      setIsSubmitting("submitting");
      try {
        await autosave.save(retry);
        if (!autosave.dirty) {
          setTitle(autosave.draft);
          setIsSubmitting("submitted");
        }
        setError("");
      } catch (failure) {
        setIsSubmitting("failed");
        setError(mutationMessage(failure));
      }
    },
    [autosave, setIsSubmitting]
  );
  const delayedSave = useMemo(() => debounce(save, 1500), [save]);
  useEffect(
    () => () => {
      delayedSave.cancel();
      if (autosave.canFlushOnUnmount) void save();
    },
    [autosave, delayedSave, save]
  );
  if (disabled) return <div className="text-20 font-medium whitespace-pre-line">{title}</div>;
  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("relative", containerClassName)}>
        <TextArea
          id={id}
          aria-label={t("issue.title.label")}
          className={cn(
            "block w-full resize-none overflow-hidden rounded-sm border-none bg-transparent px-3 py-0 text-20 font-medium ring-0 outline-none",
            { "mx-2.5 ring-1 ring-danger-strong": title.length === 0 },
            className
          )}
          value={title}
          onChange={(event) => {
            const nextTitle = event.target.value;
            autosave.edit(nextTitle, onSubmit);
            setTitle(nextTitle);
            setIsSubmitting(autosave.status);
            delayedSave();
          }}
          maxLength={255}
          placeholder={t("issue.title.label")}
          onFocus={() => setIsLengthVisible(true)}
          onBlur={() => {
            setIsLengthVisible(false);
            delayedSave.cancel();
            void save();
          }}
        />
        <div
          className={cn(
            "pointer-events-none absolute right-1 bottom-1 z-[2] rounded-sm bg-surface-1 p-0.5 text-11 text-secondary opacity-0 transition-opacity",
            { "opacity-100": isLengthVisible }
          )}
        >
          <span className={title.length === 0 ? "text-danger-primary" : ""}>{title.length}</span>/255
        </div>
      </div>
      {title.length === 0 && (
        <span className="text-13 font-medium text-danger-primary">{t("form.title.required")}</span>
      )}
      {error && (
        <div className="space-y-1">
          <p role="alert" className="text-13 text-danger-primary">
            {error}
          </p>
          <Button variant="secondary" disabled={autosave.saving} onClick={() => void save(true)}>
            Retry saving title
          </Button>
        </div>
      )}
    </div>
  );
}
