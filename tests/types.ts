import { loadingIterator, type PageLoader } from "../src/iter/index.js";

const page: PageLoader<number> = async (signal) => {
  const forwarded: AbortSignal | undefined = signal;
  forwarded?.throwIfAborted();
  const items: readonly number[] = [1, 2];
  return { items, hasMore: false };
};
const iterator: AsyncGenerator<number, void, unknown> = loadingIterator(page);
const strings: AsyncGenerator<string, void, unknown> = loadingIterator(
  async () => ({
    items: ["hello"],
    hasMore: false,
  }),
);
void iterator;
void strings;

// @ts-expect-error A page must explicitly declare whether another page may exist.
loadingIterator(async () => ({ items: [1] }));
// @ts-expect-error A loader resolves a batch; a plain item is not a batch.
loadingIterator(async () => 1);
// @ts-expect-error An explicitly selected item type must match the loader's items.
loadingIterator<string>(async () => ({ items: [1], hasMore: false }));

// Async generators await promise-valued items, including their public result type.
const resolved: AsyncGenerator<number, void, unknown> = loadingIterator(
  async () => ({
    items: [Promise.resolve(1)],
    hasMore: false,
  }),
);
void resolved;
