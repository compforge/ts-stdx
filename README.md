# ts-stdx

Small TypeScript standard-library extensions. Runtime code uses native language protocols and has no external dependencies.

## Lazy loading iterator

`loadingIterator` turns an asynchronous page loader into a native `AsyncGenerator`.
The loader owns query conditions, page size and cursor state; consumers use `for await` to process individual items.
Import from `@compforge/ts-stdx/iter`:

```ts
import { loadingIterator } from "@compforge/ts-stdx/iter";

const values = ["alice", "bob", "carol"];
let offset = 0;
const users = loadingIterator(async () => {
  const items = values.slice(offset, offset + 2);
  offset += items.length;
  return { items, hasMore: offset < values.length };
});

for await (const user of users) {
  console.log(user);
}
```

For an API or database, keep its continuation token inside the loader closure and
return `{ items, hasMore }` after each request. Give each iterator its own loader state.
An optional second argument forwards an `AbortSignal` to every loader invocation.

## Behavior

- Construction performs no I/O. Loading is sequential, keeps one batch at a time and requests the next batch only after the current batch is consumed.
- A final batch is yielded even when `hasMore` is false. Empty intermediate batches are allowed if the loader still advances toward completion.
- The generator is single-use and intended for one consumer. An early `break`, a consumer exception inside `for await`, or `return()` closes it. A later traversal yields nothing.
- Promise-valued items are awaited, as with native async generators. The result type is `AsyncGenerator<Awaited<T>, void, unknown>`.
- A loader rejection propagates unchanged and closes iteration. There is no automatic retry. Native async iteration represents a failed load as an exception, rather than an item containing an error.
- Cancellation is checked before loading, after loading and before each item. Aborting during a load discards that batch when the load settles. The loader must honor the signal to interrupt I/O promptly and release its per-query resources before returning.
- Loader cursor progress records fetched batches, not processed items. After an early exit it can be ahead of consumption; durable checkpoints and business retries belong to the consumer.

The behavior follows [go-stdx's loading iterator](https://github.com/compforge/go-stdx/pull/31), expressed through native TypeScript async iteration.

## Development

Use Node.js 22+ and npm:

```sh
npm ci
make fix
make lint
make test
npm pack --dry-run
```

Checks run across the complete component. `make lint` checks formatting, implementation types and public API type cases.
`make test` builds the package and runs Node's test runner. `npm pack` builds ESM and type declarations; the package exports the `./iter` subpath.
