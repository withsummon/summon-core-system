import { useEffect, useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
import { useDocumentAssetReader } from "./use-document-asset-reader";
import { embeddedImage } from "./export-images";
import { exportContent } from "./export-content";
const sizes = ["A4", "A3", "A2", "LETTER", "LEGAL", "TABLOID"] as const;
export function DocumentExport({
  documentId,
  getToken,
  snapshot,
}: {
  documentId: Id<"documents">;
  getToken: () => string;
  snapshot: () => { html: string; title: string };
}) {
  const { read, transfers } = useDocumentAssetReader(documentId, getToken);
  const [format, setFormat] = useState<"pdf" | "markdown">("pdf"),
    [pageSize, setPageSize] = useState<(typeof sizes)[number]>("A4");
  const [noImages, setNoImages] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null);
  useEffect(
    () => () => {
      if (download) transfers.release(download.url);
    },
    [download, transfers]
  );
  async function generate() {
    setPending(true);
    setError("");
    setDownload(null);
    try {
      await transfers.run(async (signal) => {
        const client = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
        client.setAuth(getToken());
        await client.query(api.documents.index.get, { documentId });
        signal.throwIfAborted();
        const captured = snapshot();
        const loaded = new Map<string, string>();
        let bytes = 0;
        const content = await exportContent({
          ...captured,
          noImages,
          format,
          resolveImage: async (source) => {
            const existing = loaded.get(source);
            if (existing) return existing;
            if (loaded.size >= 100)
              throw new Error("Export supports up to 100 images. Choose No images for this document.");
            const { blob } = await read(source, signal);
            bytes += blob.size;
            if (bytes > 32 * 1024 * 1024)
              throw new Error("Export supports up to 32 MiB of images. Choose No images for this document.");
            const url = await embeddedImage(blob, signal);
            loaded.set(source, url);
            return url;
          },
        });
        const blob =
          format === "markdown"
            ? new Blob([content], { type: "text/markdown;charset=utf-8" })
            : await (async () => {
                const [{ pdf }, { PDFDocument }] = await Promise.all([
                  import("@react-pdf/renderer"),
                  import("@/components/editor/pdf/document"),
                ]);
                return pdf(<PDFDocument content={content} pageFormat={pageSize} />).toBlob();
              })();
        client.setAuth(getToken());
        await client.query(api.documents.index.get, { documentId });
        signal.throwIfAborted();
        const base =
          captured.title
            .toLowerCase()
            .replace(/[^a-z0-9-_]/g, "-")
            .replace(/-+/g, "-") || "document";
        setDownload({
          url: transfers.objectUrl(blob, signal),
          name: `${base}${format === "pdf" ? `-${pageSize.toLowerCase()}.pdf` : ".md"}`,
        });
      });
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-3 rounded-md border border-subtle-1 p-3 text-14">
      <p>Export the content currently in your editor.</p>
      <p className="text-12 text-secondary">
        Includes up to 100 images and 32 MiB. Image files are embedded in the download.
      </p>
      <div className="flex flex-wrap gap-3">
        <SummonField label="Format" htmlFor="document-export-format">
          <select
            id="document-export-format"
            value={format}
            disabled={pending}
            className="rounded-md border border-subtle-1 bg-layer-2 p-2"
            onChange={(event) => {
              if (event.target.value === "pdf" || event.target.value === "markdown") setFormat(event.target.value);
            }}
          >
            <option value="pdf">PDF</option>
            <option value="markdown">Markdown</option>
          </select>
        </SummonField>
        {format === "pdf" && (
          <SummonField label="Page size" htmlFor="document-export-size">
            <select
              id="document-export-size"
              value={pageSize}
              disabled={pending}
              className="rounded-md border border-subtle-1 bg-layer-2 p-2"
              onChange={(event) => {
                const size = sizes.find((value) => value === event.target.value);
                if (size) setPageSize(size);
              }}
            >
              {sizes.map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          </SummonField>
        )}
        <SummonField label="Content" htmlFor="document-export-content">
          <select
            id="document-export-content"
            value={noImages ? "no-images" : "everything"}
            disabled={pending}
            className="rounded-md border border-subtle-1 bg-layer-2 p-2"
            onChange={(event) => setNoImages(event.target.value === "no-images")}
          >
            <option value="everything">Everything</option>
            <option value="no-images">No images</option>
          </select>
        </SummonField>
      </div>
      <Button loading={pending} onClick={() => void generate()}>
        Prepare export
      </Button>
      {error && (
        <p role="alert" className="text-danger-primary">
          {error}
        </p>
      )}
      {download && (
        <a className="block font-medium text-accent-primary underline" href={download.url} download={download.name}>
          Download {download.name}
        </a>
      )}
    </div>
  );
}
