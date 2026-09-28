/** One mounted text editor owns its draft and serial acknowledgements. */
export class TextAutosave {
  draft: string;
  private saved: string;
  private inFlight: Promise<void> | undefined;
  private failed = false;
  private failure: unknown;

  private submit: (text: string) => Promise<string>;

  constructor(text: string, submit: (text: string) => Promise<string>) {
    this.submit = submit;
    this.draft = text;
    this.saved = text;
  }
  get dirty() {
    return this.draft !== this.saved;
  }
  get saving() {
    return this.inFlight !== undefined;
  }
  get status() {
    if (this.failed) return "failed";
    return this.dirty || this.inFlight ? "submitting" : "saved";
  }
  get canFlushOnUnmount() {
    return this.dirty && !this.failed;
  }
  receive(text: string) {
    if (this.dirty || this.inFlight || this.failed) return false;
    this.saved = text;
    this.draft = text;
    return true;
  }
  edit(text: string, submit: (text: string) => Promise<string>) {
    // Capture the revision-bearing writer when editing starts, before debounce.
    if (!this.dirty && !this.inFlight && !this.failed) this.submit = submit;
    this.draft = text;
  }
  save(retry = false): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (!retry && this.failed) return Promise.reject(this.failure);
    if (!retry && !this.dirty) return Promise.resolve();
    if (retry) this.failed = false;
    this.inFlight = this.drain().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }
  private async drain() {
    try {
      do {
        const submitted = this.draft;
        // Saves must serialize: parallel requests could acknowledge or overwrite newer content.
        // oxlint-disable-next-line no-await-in-loop
        this.saved = await this.submit(submitted);
        if (this.draft === submitted) this.draft = this.saved;
      } while (this.dirty);
    } catch (error) {
      this.failed = true;
      this.failure = error;
      throw error;
    }
  }
}
