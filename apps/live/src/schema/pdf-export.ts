/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Schema } from "effect";

export const PdfExportRequestBody = Schema.Struct({
  pageId: Schema.NonEmptyTrimmedString,
  workspaceSlug: Schema.NonEmptyTrimmedString,
  projectId: Schema.NonEmptyTrimmedString,
  title: Schema.optional(Schema.String),
  author: Schema.optional(Schema.String),
  subject: Schema.optional(Schema.String),
  pageSize: Schema.optional(Schema.Literal("A4", "A3", "A2", "LETTER", "LEGAL", "TABLOID")),
  pageOrientation: Schema.optional(Schema.Literal("portrait", "landscape")),
  fileName: Schema.optional(Schema.String),
  noAssets: Schema.optional(Schema.Boolean),
});

export type TPdfExportRequestBody = Schema.Schema.Type<typeof PdfExportRequestBody>;

export class PdfValidationError extends Schema.TaggedError<PdfValidationError>()("PdfValidationError", {
  message: Schema.NonEmptyTrimmedString,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class PdfAuthenticationError extends Schema.TaggedError<PdfAuthenticationError>()("PdfAuthenticationError", {
  message: Schema.NonEmptyTrimmedString,
}) {}

export class PdfContentFetchError extends Schema.TaggedError<PdfContentFetchError>()("PdfContentFetchError", {
  message: Schema.NonEmptyTrimmedString,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class PdfNotFoundError extends Schema.TaggedError<PdfNotFoundError>()("PdfNotFoundError", {
  message: Schema.NonEmptyTrimmedString,
}) {}

export class PdfMetadataFetchError extends Schema.TaggedError<PdfMetadataFetchError>()("PdfMetadataFetchError", {
  message: Schema.NonEmptyTrimmedString,
  source: Schema.Literal("user-mentions"),
  cause: Schema.optional(Schema.Unknown),
}) {}

export class PdfImageProcessingError extends Schema.TaggedError<PdfImageProcessingError>()("PdfImageProcessingError", {
  message: Schema.NonEmptyTrimmedString,
  assetId: Schema.NonEmptyTrimmedString,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class PdfGenerationError extends Schema.TaggedError<PdfGenerationError>()("PdfGenerationError", {
  message: Schema.NonEmptyTrimmedString,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class PdfTimeoutError extends Schema.TaggedError<PdfTimeoutError>()("PdfTimeoutError", {
  message: Schema.NonEmptyTrimmedString,
  operation: Schema.NonEmptyTrimmedString,
}) {}

export class PdfAccessError extends Schema.TaggedError<PdfAccessError>()("PdfAccessError", {
  message: Schema.NonEmptyTrimmedString,
}) {}

export const PdfExportError = Schema.Union(
  PdfValidationError,
  PdfAuthenticationError,
  PdfAccessError,
  PdfContentFetchError,
  PdfNotFoundError,
  PdfMetadataFetchError,
  PdfImageProcessingError,
  PdfGenerationError,
  PdfTimeoutError
);

export type PdfExportError = Schema.Schema.Type<typeof PdfExportError>;
