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

## Keyed set

`KeyedSet<T, K = string>` identifies members by a caller-selected key instead of
object reference. Import from `@compforge/ts-stdx/collections`:

```ts
import { KeyedSet } from "@compforge/ts-stdx/collections";

type PersonRef = { readonly uid: string; name: string };
const people = new KeyedSet<PersonRef>(
  (person) => person.uid,
  [{ uid: "a", name: "Alice" }],
);
people.add({ uid: "a", name: "Updated Alice" });
people.has({ uid: "a", name: "Another instance" }); // true
people.size; // 1

const other = new KeyedSet<PersonRef>(
  (person) => person.uid,
  [{ uid: "a", name: "Different metadata" }],
);
people.equals(other); // true: same keys
```

- Supports `add`, `has`, `delete`, `clear`, `size`, `forEach`, and native iteration.
  `keys()` returns members and `entries()` returns `[member, member]`, as with Set.
- Unlike native Set, `add` replaces the member with the same key. It preserves that
  key's original insertion position; deleting and re-adding moves it to the end.
  Traversal follows native Map's live iteration behavior.
- Keys follow native Map equality (SameValueZero). String and number keys compare
  by value; object keys still compare by reference. Keep a member's selected key
  stable while stored, and use the same key semantics for sets compared with `equals`.
  Selector functions need not be the same function instance.
- `equals` compares stored keys, ignoring iteration order and non-key fields. It
  does not compare the full member bodies. Operations do not clone members.
- `ReadonlySet<T>` is available as a read-only TypeScript view; the collection is
  not a native Set instance. No native Set algebra methods are provided.
- JSON and cloning boundaries belong to the caller: encode `[...people]`, validate
  the decoded members, and reconstruct `new KeyedSet(keyOf, members)`. Direct JSON
  serialization or `structuredClone` does not preserve this custom collection.
  For a stable fingerprint, sort the encoded keys or members explicitly; traversal
  order is not collection identity.

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
`make test` builds the package and runs Node's test runner. `npm pack` builds ESM and type declarations; the package exports the `./iter` and `./collections` subpaths.
