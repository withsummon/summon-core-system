/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { JSONContent } from "@tiptap/core";
import type { TPdfExportRequestBody } from "@/schema/pdf-export";
import type { Style } from "@react-pdf/types";

export type TipTapMark = NonNullable<JSONContent["marks"]>[number];
export type TipTapNode = JSONContent;
export type TipTapDocument = JSONContent;

export type KeyGenerator = () => string;

export type PDFRenderContext = {
  getKey: KeyGenerator;
  metadata?: PDFExportMetadata;
};

export type PDFNodeRenderer = (
  node: TipTapNode,
  children: React.ReactElement[],
  context: PDFRenderContext
) => React.ReactElement;

export type PDFMarkRenderer = (mark: TipTapMark, currentStyle: Style) => Style;

export type NodeRendererRegistry = Record<string, PDFNodeRenderer>;

export type MarkRendererRegistry = Record<string, PDFMarkRenderer>;

export type PDFExportOptions = Pick<
  TPdfExportRequestBody,
  "title" | "author" | "subject" | "pageSize" | "pageOrientation" | "noAssets"
> & { metadata?: PDFExportMetadata };

/**
 * Metadata for resolving entity references in PDF export
 */
export type PDFExportMetadata = {
  /** User mentions (user_mention in mention node) */
  userMentions?: Map<string, string>;
  /** Resolved image URLs: Map of asset ID to presigned URL */
  resolvedImageUrls?: Record<string, string>;
  /** When true, images and other assets are excluded from the PDF */
  noAssets?: boolean;
};
