import { Hocuspocus } from "@hocuspocus/server";
import type { Document } from "@hocuspocus/server";

// Hocuspocus 2.15 deletes by room name after asynchronous unload hooks. A delayed
// disconnect for an old room can otherwise evict a newly connected generation.
export class ConvexHocuspocus extends Hocuspocus {
  override async unloadDocument(document: Document): Promise<void> {
    if (this.documents.get(document.name) !== document) return;
    this.documents.delete(document.name);
    await this.hooks("beforeUnloadDocument", { instance: this, documentName: document.name });
    document.destroy();
    await this.hooks("afterUnloadDocument", { instance: this, documentName: document.name });
  }
}
