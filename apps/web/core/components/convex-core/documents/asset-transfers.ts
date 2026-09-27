/** Owns browser-only bytes and URLs for one mounted document editor. */
export class AssetTransfers {
  private controllers = new Set<AbortController>();
  private urls = new Set<string>();

  async run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    this.controllers.add(controller);
    try {
      return await operation(controller.signal);
    } finally {
      this.controllers.delete(controller);
    }
  }

  objectUrl(blob: Blob, signal: AbortSignal) {
    signal.throwIfAborted();
    const url = URL.createObjectURL(blob);
    this.urls.add(url);
    return url;
  }

  release(url: string) {
    if (this.urls.delete(url)) URL.revokeObjectURL(url);
  }

  cancel() {
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }

  dispose() {
    this.cancel();
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear();
  }
}

export async function uploadedStorageId(response: Response) {
  if (!response.ok) throw new Error("File upload failed. Try again.");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("storageId" in result) || typeof result.storageId !== "string")
    throw new Error("The upload service returned an invalid file reference.");
  return result.storageId;
}
