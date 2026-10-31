import assert from "node:assert/strict";
import { test } from "node:test";
import { KeyedSet } from "@compforge/ts-stdx/collections";

const byUid = (person) => person.uid;

test("independent objects with the same UID are one member; add replaces the retained reference", () => {
  const first = { uid: "a", name: "Before" };
  const second = { uid: "b", name: "B" };
  const latest = { uid: "a", name: "After" };
  const people = new KeyedSet(byUid, [first, second, latest]);
  assert.equal(people.size, 2);
  assert.deepEqual([...people], [latest, second]);
  assert.equal([...people][0], latest);
  assert.equal(people.has({ uid: "a" }), true);
  assert.equal(people.has({ uid: "missing" }), false);
  assert.equal(people.add(latest), people);
  assert.equal(people.delete({ uid: "a" }), true);
  assert.equal(people.delete({ uid: "a" }), false);
  people.add(first);
  assert.deepEqual([...people], [second, first]);
  people.clear();
  assert.equal(people.size, 0);
  assert.deepEqual([...people], []);
});

test("equality ignores insertion order, duplicates, object instances and non-key fields", () => {
  const left = new KeyedSet(byUid, [{ uid: "a" }, { uid: "b" }]);
  const right = new KeyedSet(
    (person) => person.uid,
    [{ uid: "b", name: "Updated" }, { uid: "a" }, { uid: "a" }],
  );
  assert.equal(left.equals(right), true);
  assert.equal(right.equals(left), true);
  assert.equal(left.equals(left), true);
  assert.equal(new KeyedSet(byUid).equals(new KeyedSet(byUid)), true);
  assert.equal(left.equals(new KeyedSet(byUid, [{ uid: "a" }])), false);
  assert.equal(
    left.equals(new KeyedSet(byUid, [{ uid: "a" }, { uid: "c" }])),
    false,
  );
});

test("key equality follows Map for numeric keys including NaN and signed zero", () => {
  const values = new KeyedSet(
    (item) => item.id,
    [{ id: NaN }, { id: -0 }, { id: 0 }],
  );
  assert.equal(values.size, 2);
  assert.equal(values.has({ id: NaN }), true);
  assert.equal(values.has({ id: -0 }), true);
  assert.equal(
    values.equals(new KeyedSet((item) => item.id, [{ id: 0 }, { id: NaN }])),
    true,
  );
});

test("Set iteration exposes members and forEach passes the set and thisArg", () => {
  function* source() {
    yield { uid: "a" };
    yield { uid: "b" };
  }
  const people = new KeyedSet(byUid, source());
  assert.deepEqual([...people.keys()], [...people.values()]);
  assert.deepEqual(
    [...people.entries()],
    [...people].map((person) => [person, person]),
  );
  const seen = [];
  people.forEach(function (value, again, set) {
    assert.equal(this, seen);
    assert.equal(value, again);
    assert.equal(set, people);
    this.push(value.uid);
  }, seen);
  assert.deepEqual(seen, ["a", "b"]);
});

test("iteration sees removals, replacements and additions made before visiting a member", () => {
  const people = new KeyedSet(byUid, [
    { uid: "a" },
    { uid: "b" },
    { uid: "c" },
  ]);
  const iterator = people.values();
  assert.equal(iterator.next().value.uid, "a");
  people.delete({ uid: "b" });
  const updated = { uid: "c", name: "Updated" };
  people.add(updated).add({ uid: "d" });
  assert.deepEqual([...iterator], [updated, { uid: "d" }]);
});

test("JSON boundaries explicitly encode members and restore their identity rule", () => {
  const people = new KeyedSet(byUid, [{ uid: "a" }, { uid: "b" }]);
  const encoded = JSON.stringify([...people]);
  const restored = new KeyedSet(byUid, JSON.parse(encoded));
  assert.equal(restored.equals(people), true);
  assert.equal(restored.has({ uid: "a" }), true);
  restored.add({ uid: "a" });
  assert.equal(restored.size, 2);
});

test("a failing key selector leaves the collection unchanged", () => {
  const error = new Error("No identity");
  const people = new KeyedSet(
    (person) => {
      if (!person.uid) throw error;
      return person.uid;
    },
    [{ uid: "a" }],
  );
  assert.throws(
    () => people.add({}),
    (value) => value === error,
  );
  assert.deepEqual([...people], [{ uid: "a" }]);
});

test("frozen membership rejects all mutations and clone remains independently mutable", () => {
  const original = new KeyedSet(
    (value) => value.id,
    [{ id: "a", nested: { n: 1 } }],
  );
  const copy = original.clone(structuredClone);
  original.freeze();
  for (const mutate of [
    () => original.add({ id: "b" }),
    () => original.delete({ id: "a" }),
    () => original.clear(),
  ]) {
    assert.throws(mutate, TypeError);
  }
  copy.add({ id: "b" });
  [...copy][0].nested.n = 2;
  assert.equal(original.size, 1);
  assert.equal([...original][0].nested.n, 1);
  assert.equal(copy.has({ id: "a" }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(original)), [
    { id: "a", nested: { n: 1 } },
  ]);
  const frozen = Object.freeze(new KeyedSet((x) => x, [1]));
  assert.throws(() => frozen.add(2), TypeError);
});
