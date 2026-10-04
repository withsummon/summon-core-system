/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { ESTIMATE_SYSTEMS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { ChevronLeftIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { EstimatePointCreateRoot } from "../points";
import { EstimateCreateStageOne } from "./stage-one";

export function CreateEstimateModal({
  projectId,
  configuration,
  onClose,
}: {
  projectId: FunctionArgs<typeof api.estimates.index.create>["projectId"];
  configuration: FunctionReturnType<typeof api.estimates.index.list>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useMutation(api.estimates.index.create);
  const [revision] = useState(configuration.config?.revision ?? 0);
  const [type, setType] = useState<FunctionArgs<typeof api.estimates.index.create>["type"]>("points");
  const [points, setPoints] = useState<FunctionArgs<typeof api.estimates.index.create>["points"] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const release = useReloadConfirmations(
    points !== null || pending,
    "This estimate system has unsaved changes.",
    undefined,
    pending
  );
  const close = () => {
    if (!pending) {
      release();
      onClose();
    }
  };
  return (
    <ModalCore isOpen handleClose={close} position={EModalPosition.TOP} width={EModalWidth.XXL}>
      <form
        className="relative space-y-6 py-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!points || pending) return;
          setPending(true);
          setError("");
          try {
            await create({
              projectId,
              type,
              name: ESTIMATE_SYSTEMS[type].name,
              description: "",
              points,
              rememberSelection: { expectedRevision: revision },
            });
            setToast({
              type: TOAST_TYPE.SUCCESS,
              title: t("project_settings.estimates.toasts.created.success.title"),
              message: t("project_settings.estimates.toasts.created.success.message"),
            });
            release();
            onClose();
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="relative flex items-center justify-between gap-2 px-5">
          <div className="flex items-center gap-1">
            {points && (
              <button
                type="button"
                aria-label="Back to estimate templates"
                disabled={pending}
                onClick={() => setPoints(null)}
                className="flex size-5 items-center justify-center"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
            )}
            <Dialog.Title className="text-18 font-medium text-primary">
              {t("project_settings.estimates.new")}
            </Dialog.Title>
          </div>
          <span className="text-11 text-tertiary">
            {t("project_settings.estimates.create.step", { step: points ? "2" : "1", total: 2 })}
          </span>
        </div>
        <fieldset
          className="px-5"
          disabled={pending || !configuration.canWrite || !configuration.canSelect || !!configuration.config?.jobId}
        >
          {points ? (
            <EstimatePointCreateRoot
              points={points}
              onChange={setPoints}
              type={type}
              disabled={pending || !configuration.canWrite || !configuration.canSelect || !!configuration.config?.jobId}
            />
          ) : (
            <EstimateCreateStageOne
              estimateSystem={type}
              types={configuration.types}
              onTypeChange={setType}
              onTemplate={setPoints}
            />
          )}
          {error && (
            <p role="alert" className="mt-3 text-14 text-danger-primary">
              {error}
            </p>
          )}
        </fieldset>
        <div className="flex justify-end gap-3 border-t border-subtle px-5 pt-5">
          <Button type="button" variant="secondary" size="lg" onClick={close} disabled={pending}>
            {t("common.cancel")}
          </Button>
          {points && (
            <Button
              type="submit"
              size="lg"
              loading={pending}
              disabled={!configuration.canWrite || !configuration.canSelect || !!configuration.config?.jobId}
            >
              {t("project_settings.estimates.create.label")}
            </Button>
          )}
        </div>
      </form>
    </ModalCore>
  );
}
