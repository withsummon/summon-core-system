/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Link, useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { getButtonStyling } from "@plane/propel/button";
import { getPageName } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { DocumentEditor } from "@/components/convex-core/documents/editor";
import { RecordVisit } from "@/components/convex-core/navigation/record-visit";
import { PageContentLoader } from "@/components/pages/loaders/page-content-loader";
import { PageDetailsHeader } from "../header";
import type { Route } from "./+types/page";

export default function PageDetailsPage({ params }: Route.ComponentProps) {
  const address = useOutletContext<FunctionReturnType<typeof api.navigation.address.resolveProjectId>>();
  const resolved = useQuery(api.documents.index.resolve, {
    workspaceId: address.workspace._id,
    projectId: address.project._id,
    documentId: params.pageId,
  });
  if (resolved === undefined) return <PageContentLoader />;
  if (resolved === null)
    return (
      <section className="flex h-full flex-col items-center justify-center gap-3">
        <h1 className="text-16 font-semibold">Page not found</h1>
        <p className="text-13 text-secondary">This page is unavailable or you no longer have access.</p>
        <Link
          to={`/${address.workspace.slug}/projects/${address.project._id}/pages/`}
          className={getButtonStyling("secondary", "base")}
        >
          View other Pages
        </Link>
      </section>
    );
  return (
    <>
      <PageHead title={getPageName(resolved.document.name)} />
      <RecordVisit workspaceId={resolved.document.workspaceId} target={{ type: "page", id: resolved.document._id }} />
      <DocumentEditor
        key={resolved.document._id}
        document={resolved.document}
        context={resolved.context}
        renderHeader={(state, actions, isSaving) => (
          <PageDetailsHeader
            address={address}
            resolved={resolved}
            state={state}
            actions={actions}
            isSaving={isSaving}
          />
        )}
      />
    </>
  );
}
