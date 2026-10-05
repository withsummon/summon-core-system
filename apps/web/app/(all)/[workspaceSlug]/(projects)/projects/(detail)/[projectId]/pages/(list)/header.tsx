/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { PageIcon } from "@plane/propel/icons";
import { Spinner } from "@plane/ui";
import { Breadcrumbs, Header } from "@plane/ui";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { newDocument } from "@/components/convex-core/documents/metadata-form";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";

export function PagesListHeader({
  address,
  pageType,
  canCreate,
}: {
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
  pageType: FunctionArgs<typeof api.documents.index.list>["pageType"];
  canCreate: boolean;
}) {
  const navigate = useNavigate();
  const create = useMutation(api.documents.index.create);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const continuation = useRef<((id: FunctionReturnType<typeof api.documents.index.create>) => void) | null>(null);
  const leave = useCallback(() => {
    continuation.current = null;
  }, []);
  const release = useReloadConfirmations(pending, "The page is still being created.", leave, pending);
  useEffect(
    () => () => {
      continuation.current = null;
    },
    []
  );
  async function addPage() {
    continuation.current = (id) => navigate(`/${address.workspace.slug}/projects/${address.project._id}/pages/${id}`);
    setPending(true);
    setError("");
    try {
      const id = await create({
        ...newDocument,
        workspaceId: address.workspace._id,
        projectIds: [address.project._id],
        access: pageType === "private" ? "private" : "public",
      });
      release((allow) => {
        const open = continuation.current;
        continuation.current = null;
        if (allow) open?.(id);
      });
    } catch (failure) {
      if (continuation.current !== null) setError(mutationMessage(failure));
      continuation.current = null;
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="shrink-0 border-b border-subtle">
        <Header>
          <Header.LeftItem>
            <Breadcrumbs>
              <Breadcrumbs.Item
                component={
                  <BreadcrumbLink
                    label={address.project.name}
                    href={`/${address.workspace.slug}/projects/${address.project._id}/issues/`}
                  />
                }
              />
              <Breadcrumbs.Item
                component={<BreadcrumbLink label="Pages" icon={<PageIcon className="size-4 text-tertiary" />} isLast />}
                isLast
              />
            </Breadcrumbs>
          </Header.LeftItem>
          {canCreate && (
            <Header.RightItem>
              <Button variant="primary" size="lg" onClick={() => void addPage()} loading={pending}>
                {pending && <Spinner className="size-4" />}
                {pending ? "Adding" : "Add page"}
              </Button>
            </Header.RightItem>
          )}
        </Header>
      </div>
      {error && (
        <p role="alert" className="px-4 py-2 text-13 text-danger-primary">
          {error}
        </p>
      )}
    </>
  );
}
