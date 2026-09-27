export type DescriptionDraft = {
  description_html: string;
  description_json?: object;
  isMigrationUpdate: boolean;
};

/** One mounted description owns its draft and serial acknowledgements. */
export class DescriptionAutosave {
  draft: DescriptionDraft;
  private saved: string;
  private inFlight: Promise<void> | undefined;
  private queued = false;
  private failed = false;
  private failure: unknown;

  private submit: (draft: DescriptionDraft) => Promise<void>;

  constructor(html: string, submit: (draft: DescriptionDraft) => Promise<void>) {
    this.submit = submit;
    this.draft = { description_html: html, isMigrationUpdate: false };
    this.saved = html;
  }
  get dirty() {
    return this.draft.description_html !== this.saved;
  }
  get canFlushOnUnmount() {
    return this.dirty && !this.failed;
  }
  receive(html: string) {
    if (this.dirty || this.inFlight) return false;
    this.saved = html;
    this.draft = { description_html: html, isMigrationUpdate: false };
    return true;
  }
  edit(draft: DescriptionDraft) {
    this.draft = draft;
    this.failed = false;
  }
  setSubmit(submit: (draft: DescriptionDraft) => Promise<void>) {
    this.submit = submit;
  }
  save(): Promise<void> {
    if (this.inFlight) {
      this.queued = true;
      return this.inFlight;
    }
    if (this.failed) return Promise.reject(this.failure);
    if (!this.dirty) return Promise.resolve();
    this.inFlight = this.drain().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }
  private async drain() {
    try {
      do {
        this.queued = false;
        const submitted = this.draft;
        // Saves must serialize: parallel requests could acknowledge or overwrite newer content.
        // oxlint-disable-next-line no-await-in-loop
        await this.submit(submitted);
        this.saved = submitted.description_html;
      } while (this.queued && this.dirty);
    } catch (error) {
      this.queued = false;
      this.failed = true;
      this.failure = error;
      throw error;
    }
  }
}
