/**
 * Load the next batch, keeping query conditions, page size and cursor in the closure.
 * Each traversal needs its own loader state. Release per-query resources before returning.
 * Empty batches with hasMore=true must still advance toward the end.
 * A loader doing I/O must honor the supplied AbortSignal to cancel an in-flight request.
 */
export type PageLoader<T> = (
  signal?: AbortSignal,
) => Promise<{ items: readonly T[]; hasMore: boolean }>;

/**
 * Yield lazily loaded items using a native, single-use async generator.
 * Loading is sequential; the next batch is requested only after this batch is consumed.
 * Breaking or throwing in a for-await loop closes the generator. A failed load or
 * cancellation rejects iteration and closes it; previously yielded items remain consumed.
 *
 * @spec Construction performs no I/O; early termination never loads another batch.
 * @spec Cancellation is checked before loading, after loading and before each item.
 * @why A loader cursor describes fetched pages, not processed items; durable checkpoints belong to the consumer.
 * @see {@link component://README.md#behavior}
 * @case tests/iter.test.mjs
 */
export async function* loadingIterator<T>(
  loadPage: PageLoader<T>,
  signal?: AbortSignal,
): AsyncGenerator<Awaited<T>, void, unknown> {
  while (true) {
    signal?.throwIfAborted();
    const { items, hasMore } = await loadPage(signal);
    signal?.throwIfAborted();
    for (const item of items) {
      signal?.throwIfAborted();
      const value = await item;
      signal?.throwIfAborted();
      yield value;
    }
    if (!hasMore) return;
  }
}
