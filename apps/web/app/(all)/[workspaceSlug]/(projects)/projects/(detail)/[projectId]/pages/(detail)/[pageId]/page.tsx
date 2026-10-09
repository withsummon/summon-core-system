/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useOutletContext } from "react-router";
import { useContext } from "react";
import type { ComponentProps, ReactNode } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { getPageName } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import {
  DocumentReadBoundary,
  DocumentRecoveryContext,
  DocumentEditor,
} from "@/components/convex-core/documents/editor";
import { RecordVisit } from "@/components/convex-core/navigation/record-visit";
import { PageContentLoader } from "@/components/pages/loaders/page-content-loader";
import { PageDetailsHeader } from "../header";
import type { Route } from "./+types/page";

export default function PageDetailsPage({ params }: Route.ComponentProps) {
  const address = useOutletContext<FunctionReturnType<typeof api.navigation.address.resolveProjectId>>();
  const documentRecovery = useContext(DocumentRecoveryContext);
  if (!documentRecovery) throw new Error("Document recovery requires the document route owner.");
  const [onCapture, isSaving, recovery] = documentRecovery;
  return (
    <DocumentReadBoundary recovery={recovery(true)}>
      <PageDetailsContent
        address={address}
        documentId={params.pageId}
        onCapture={onCapture}
        isSaving={isSaving}
        recovery={recovery(false)}
      />
    </DocumentReadBoundary>
  );
}

function PageDetailsContent({
  address,
  documentId,
  onCapture,
  isSaving,
  recovery,
}: {
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
  documentId: string;
  onCapture: ComponentProps<typeof DocumentEditor>["onCapture"];
  isSaving: boolean;
  recovery: ReactNode;
}) {
  const resolved = useQuery(api.documents.index.resolve, {
    workspaceId: address.workspace._id,
    projectId: address.project._id,
    documentId,
  });
  if (resolved === undefined) return <PageContentLoader />;
  if (resolved === null) throw new Error("Page not found");
  return (
    <>
      <PageHead title={getPageName(resolved.document.name)} />
      <RecordVisit workspaceId={resolved.document.workspaceId} target={{ type: "page", id: resolved.document._id }} />
      <DocumentEditor
        key={resolved.document._id}
        document={resolved.document}
        context={resolved.context}
        onCapture={onCapture}
        isSaving={isSaving}
        recovery={recovery}
        renderHeader={(state, actions, saving) => (
          <PageDetailsHeader address={address} resolved={resolved} state={state} actions={actions} isSaving={saving} />
        )}
      />
    </>
  );
}
