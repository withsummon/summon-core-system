/** Orders delete, undo and subsequent reads for each durable editor asset. */
export class AssetLifecycle {
  private pending = new Map<string, Promise<void>>();

  run<T>(assetId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(assetId) ?? Promise.resolve();
    // A failed delete must not prevent a later explicit undo from checking current server state.
    const result = previous.then(operation, operation);
    const settled = result.then(
      () => undefined,
      () => undefined
    );
    this.pending.set(assetId, settled);
    void settled.then(() => {
      if (this.pending.get(assetId) === settled) this.pending.delete(assetId);
      return undefined;
    });
    return result;
  }

  async wait(assetId: string) {
    await this.pending.get(assetId);
  }
}
