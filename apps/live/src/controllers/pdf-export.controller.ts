/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Request, Response } from "express";
import { Effect, Schema, Cause } from "effect";
import { Controller, Post } from "@plane/decorators";
import { logger } from "@plane/logger";
import { AppError } from "@/lib/errors";
import { PdfExportRequestBody, PdfValidationError, PdfAuthenticationError, PdfExportError } from "@/schema/pdf-export";
import { exportToPdf } from "@/services/pdf-export";

@Controller("/pdf-export")
export class PdfExportController {
  constructor(
    private readonly convexUrl: string,
    private readonly siteUrl: string
  ) {}
  /**
   * Maps domain errors to HTTP responses
   */
  private mapErrorToHttpResponse(error: unknown): { status: number; error: string } {
    if (Schema.is(PdfExportError)(error)) {
      const tag = error._tag;
      const message = error.message;

      switch (tag) {
        case "PdfValidationError":
          return { status: 400, error: message };
        case "PdfAuthenticationError":
          return { status: 401, error: message };
        case "PdfAccessError":
          return { status: 403, error: message };
        case "PdfNotFoundError":
          return { status: 404, error: message };
        case "PdfContentFetchError":
          return { status: 502, error: message };
        case "PdfTimeoutError":
          return { status: 504, error: message };
        case "PdfGenerationError":
          return { status: 500, error: message };
        case "PdfMetadataFetchError":
        case "PdfImageProcessingError":
          return { status: 502, error: message };
        default:
          return { status: 500, error: message };
      }
    }
    return { status: 500, error: "Failed to generate PDF" };
  }

  @Post("/")
  async exportToPdf(req: Request, res: Response) {
    const requestId = crypto.randomUUID();

    const effect = Effect.gen(this, function* () {
      const cookie = req.headers.cookie;
      if (!cookie) return yield* Effect.fail(new PdfAuthenticationError({ message: "Authentication required" }));
      const input = yield* Schema.decodeUnknown(PdfExportRequestBody)(req.body).pipe(
        Effect.mapError((cause) => new PdfValidationError({ message: "Invalid request body", cause }))
      );
      return yield* exportToPdf(input, cookie, this.convexUrl, this.siteUrl);
    }).pipe(
      // Log errors before catching them
      Effect.tapError((error) => Effect.logError("PDF_EXPORT: Export failed", { requestId, error })),
      // Map all tagged errors to HTTP responses
      Effect.catchAll((error) => Effect.succeed(this.mapErrorToHttpResponse(error))),
      // Handle unexpected defects
      Effect.catchAllDefect((defect) => {
        const appError = new AppError(Cause.pretty(Cause.die(defect)), {
          context: { requestId, operation: "exportToPdf" },
        });
        logger.error("PDF_EXPORT: Unexpected failure", appError);
        return Effect.succeed({ status: 500, error: "Failed to generate PDF" });
      })
    );

    const result = await Effect.runPromise(effect);

    // Check if result is an error response
    if ("error" in result && "status" in result) {
      return res.status(result.status).json({ message: result.error });
    }

    // Success - send PDF
    const { pdfBuffer, outputFileName } = result;

    // Sanitize filename for Content-Disposition header to prevent header injection
    const sanitizedFileName = outputFileName
      .replace(/["\\\r\n]/g, "") // Remove quotes, backslashes, and CRLF
      .replace(/[^\x20-\x7E]/g, "_"); // Replace non-ASCII with underscore

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizedFileName}"; filename*=UTF-8''${encodeURIComponent(outputFileName)}`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  }
}
