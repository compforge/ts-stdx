import assert from "node:assert/strict";
import { test } from "node:test";
import { loadingIterator } from "@compforge/ts-stdx/iter";

async function collect(iterator) {
  const items = [];
  for await (const item of iterator) items.push(item);
  return items;
}

test("loading is lazy and does not prefetch before the current batch is consumed", async () => {
  let calls = 0;
  const iterator = loadingIterator(async () => {
    calls++;
    return calls === 1
      ? { items: [1, 2], hasMore: true }
      : { items: [3], hasMore: false };
  });
  assert.equal(calls, 0);
  assert.deepEqual(await iterator.next(), { value: 1, done: false });
  assert.equal(calls, 1);
  assert.deepEqual(await iterator.next(), { value: 2, done: false });
  assert.equal(calls, 1);
  assert.deepEqual(await iterator.next(), { value: 3, done: false });
  assert.equal(calls, 2);
  assert.deepEqual(await iterator.next(), { value: undefined, done: true });
  assert.deepEqual(await collect(iterator), []);
  assert.equal(calls, 2);
});

for (const stopAt of [1, 2]) {
  test(`breaking at item ${stopAt} closes the generator without loading another batch`, async () => {
    let calls = 0;
    const iterator = loadingIterator(async () => {
      calls++;
      return { items: [1, 2], hasMore: true };
    });
    for await (const value of iterator) if (value === stopAt) break;
    assert.equal(calls, 1);
    assert.deepEqual(await collect(iterator), []);
    assert.equal(calls, 1);
  });
}

test("a consumer exception closes the iterator", async () => {
  const failure = new Error("processing failed");
  let calls = 0;
  const iterator = loadingIterator(async () => {
    calls++;
    return { items: [1, 2], hasMore: true };
  });
  await assert.rejects(
    async () => {
      for await (const _value of iterator) throw failure;
    },
    (error) => error === failure,
  );
  assert.deepEqual(await collect(iterator), []);
  assert.equal(calls, 1);
});

test("empty intermediate batches advance; the final batch is still yielded", async () => {
  const batches = [[], [1], [], [2, 3]];
  let offset = 0;
  const iterator = loadingIterator(async () => ({
    items: batches[offset++],
    hasMore: offset < batches.length,
  }));
  assert.deepEqual(await collect(iterator), [1, 2, 3]);
  assert.equal(offset, batches.length);
});

test("an empty final batch completes without another request", async () => {
  let calls = 0;
  const iterator = loadingIterator(async () => {
    calls++;
    return { items: [], hasMore: false };
  });
  assert.deepEqual(await collect(iterator), []);
  assert.equal(calls, 1);
});

test("a failed load rejects once, preserves the original error and never retries", async () => {
  const failure = new Error("page unavailable");
  let calls = 0;
  const iterator = loadingIterator(async () => {
    if (++calls === 1) return { items: [1], hasMore: true };
    throw failure;
  });
  assert.deepEqual(await iterator.next(), { value: 1, done: false });
  await assert.rejects(iterator.next(), (error) => error === failure);
  assert.deepEqual(await iterator.next(), { value: undefined, done: true });
  assert.equal(calls, 2);
});

test("an already-aborted signal prevents the first request", async () => {
  const controller = new AbortController();
  const reason = new Error("cancelled before loading");
  controller.abort(reason);
  let calls = 0;
  const iterator = loadingIterator(async () => {
    calls++;
    return { items: [1], hasMore: false };
  }, controller.signal);
  await assert.rejects(iterator.next(), (error) => error === reason);
  assert.equal(calls, 0);
  assert.deepEqual(await collect(iterator), []);
});

for (const items of [[1, 2], []]) {
  test(`cancelling during a load discards its ${items.length}-item final batch`, async () => {
    const controller = new AbortController();
    const reason = new Error("cancelled while loading");
    const iterator = loadingIterator(async (signal) => {
      assert.equal(signal, controller.signal);
      controller.abort(reason);
      return { items, hasMore: false };
    }, controller.signal);
    await assert.rejects(iterator.next(), (error) => error === reason);
    assert.deepEqual(await collect(iterator), []);
  });
}

test("cancelling between items stops delivery and prevents another request", async () => {
  const controller = new AbortController();
  let calls = 0;
  const iterator = loadingIterator(async (signal) => {
    assert.equal(signal, controller.signal);
    calls++;
    return { items: [1, 2], hasMore: true };
  }, controller.signal);
  assert.deepEqual(await iterator.next(), { value: 1, done: false });
  controller.abort();
  await assert.rejects(iterator.next(), { name: "AbortError" });
  assert.deepEqual(await collect(iterator), []);
  assert.equal(calls, 1);
});

test("a loader can cancel an in-flight wait through the forwarded signal", async () => {
  const controller = new AbortController();
  const reason = new Error("cancelled I/O");
  let ready;
  const started = new Promise((resolve) => {
    ready = resolve;
  });
  const iterator = loadingIterator(
    (signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
        ready();
      }),
    controller.signal,
  );
  const next = iterator.next();
  await started;
  controller.abort(reason);
  await assert.rejects(next, (error) => error === reason);
  assert.deepEqual(await collect(iterator), []);
});

test("closing before traversal performs no I/O", async () => {
  let calls = 0;
  const iterator = loadingIterator(async () => {
    calls++;
    return { items: [1], hasMore: true };
  });
  await iterator.return();
  assert.deepEqual(await collect(iterator), []);
  assert.equal(calls, 0);
});

test("undefined is a valid item, distinct from iterator completion", async () => {
  const iterator = loadingIterator(async (signal) => {
    assert.equal(signal, undefined);
    return { items: [undefined], hasMore: false };
  });
  assert.deepEqual(await iterator.next(), { value: undefined, done: false });
  assert.deepEqual(await iterator.next(), { value: undefined, done: true });
});

test("promise-valued items follow native async-generator unwrapping", async () => {
  const iterator = loadingIterator(async () => ({
    items: [Promise.resolve(1), Promise.resolve(2)],
    hasMore: false,
  }));
  assert.deepEqual(await collect(iterator), [1, 2]);
});

test("cancellation while awaiting an item prevents that item from being yielded", async () => {
  const controller = new AbortController();
  const reason = new Error("cancelled while awaiting an item");
  let resolveItem;
  let itemStarted;
  const started = new Promise((resolve) => {
    itemStarted = resolve;
  });
  const item = {
    then(resolve) {
      resolveItem = resolve;
      itemStarted();
    },
  };
  const iterator = loadingIterator(
    async () => ({ items: [item], hasMore: false }),
    controller.signal,
  );
  const next = iterator.next();
  await started;
  controller.abort(reason);
  resolveItem(1);
  await assert.rejects(next, (error) => error === reason);
  assert.deepEqual(await collect(iterator), []);
});
