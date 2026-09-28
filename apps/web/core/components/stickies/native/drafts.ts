import { ConvexError } from "convex/values";
export type StickyPatch = { html?: string; backgroundColor?: string };
export type StickyDraft = {
  html: string;
  backgroundColor: string | null;
  updatedAt: number;
  pending: boolean;
  error: string | null;
};
/** One serial writer per note, shared by every mounted presentation. */
export class StickyDrafts {
  private active = true;
  private entries = new Map<
    string,
    { value: StickyDraft; changes: StickyPatch; running: boolean; timer?: ReturnType<typeof setTimeout> }
  >();
  private save: (id: string, revision: number, changes: StickyPatch) => Promise<{ updatedAt: number }>;
  private changed: () => void;
  constructor(
    save: (id: string, revision: number, changes: StickyPatch) => Promise<{ updatedAt: number }>,
    changed: () => void
  ) {
    this.save = save;
    this.changed = changed;
  }
  observe(id: string, row: Pick<StickyDraft, "html" | "backgroundColor" | "updatedAt">) {
    const entry = this.entries.get(id);
    if (!entry) this.entries.set(id, { value: { ...row, pending: false, error: null }, changes: {}, running: false });
    else if (!entry.running && !entry.value.pending && !entry.value.error && row.updatedAt >= entry.value.updatedAt)
      entry.value = { ...row, pending: false, error: null };
  }
  get(id: string) {
    return this.entries.get(id)?.value;
  }
  edit(id: string, patch: StickyPatch) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error("Sticky is not loaded.");
    if (
      (patch.html === undefined || patch.html === entry.value.html) &&
      (patch.backgroundColor === undefined || patch.backgroundColor === entry.value.backgroundColor)
    )
      return;
    entry.value = { ...entry.value, ...patch, pending: true };
    entry.changes = { ...entry.changes, ...patch };
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      void this.flush(id);
    }, 500);
    this.changed();
  }
  async flush(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!this.active || !entry || entry.running || entry.value.error || !entry.value.pending) return;
    clearTimeout(entry.timer);
    entry.running = true;
    const changes = entry.changes;
    entry.changes = {};
    try {
      const result = await this.save(id, entry.value.updatedAt, changes);
      entry.value = { ...entry.value, updatedAt: result.updatedAt, pending: Object.keys(entry.changes).length > 0 };
    } catch (error) {
      entry.changes = { ...changes, ...entry.changes };
      entry.value = {
        ...entry.value,
        error:
          error instanceof ConvexError && typeof error.data === "string"
            ? error.data
            : error instanceof Error
              ? error.message
              : "Unable to save sticky.",
      };
    } finally {
      entry.running = false;
      this.changed();
    }
    if (entry.value.pending && !entry.value.error) await this.flush(id);
  }
  async changeRevision(id: string, operation: (revision: number) => Promise<{ updatedAt: number }>) {
    const entry = this.entries.get(id);
    if (!entry || entry.running || entry.value.pending || entry.value.error)
      throw new Error("Wait for the sticky to save before moving it.");
    entry.running = true;
    try {
      const result = await operation(entry.value.updatedAt);
      entry.value = { ...entry.value, updatedAt: result.updatedAt };
    } finally {
      entry.running = false;
      this.changed();
      await this.flush(id);
    }
  }
  discard(id: string, row: Pick<StickyDraft, "html" | "backgroundColor" | "updatedAt">) {
    const entry = this.entries.get(id);
    if (entry?.running) throw new Error("Wait for the current save.");
    clearTimeout(entry?.timer);
    this.entries.set(id, { value: { ...row, pending: false, error: null }, changes: {}, running: false });
    this.changed();
  }
  hasUnsaved() {
    return [...this.entries.values()].some((entry) => entry.running || entry.value.pending || entry.value.error);
  }
  async flushAll() {
    await Promise.all([...this.entries.keys()].map((id) => this.flush(id)));
    if (this.hasUnsaved())
      throw new ConvexError(
        "Some sticky changes are still unsaved. Wait for saving or resolve the note's error before leaving."
      );
  }
  async retry(id: string) {
    const entry = this.entries.get(id);
    if (!entry || entry.running) return;
    entry.value = { ...entry.value, error: null };
    await this.flush(id);
  }
  activate() {
    this.active = true;
  }
  dispose() {
    this.active = false;
    for (const entry of this.entries.values()) clearTimeout(entry.timer);
  }
}
