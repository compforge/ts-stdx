/**
 * A set whose member identity is selected by keyOf rather than object reference.
 * Keys use native Map equality (SameValueZero). Keep each member's key stable
 * while it belongs to the set; remove it before changing its key.
 *
 * @spec Adding an existing key replaces its member without changing iteration order.
 * @spec Equality compares stored keys, ignoring order and non-key member fields.
 * @why Key selection belongs to the caller; no equality methods are required on members.
 * @see {@link component://README.md#keyed-set}
 * @case tests/collections.test.mjs
 */
export class KeyedSet<T, K = string> implements ReadonlySet<T> {
  readonly #members = new Map<K, T>();
  readonly #keyOf: (value: T) => K;
  readonly [Symbol.toStringTag] = "KeyedSet";

  constructor(keyOf: (value: T) => K, values: Iterable<T> = []) {
    this.#keyOf = keyOf;
    for (const value of values) this.add(value);
  }

  get size(): number {
    return this.#members.size;
  }

  add(value: T): this {
    this.assertMutable();
    this.#members.set(this.#keyOf(value), value);
    return this;
  }

  has(value: T): boolean {
    return this.#members.has(this.#keyOf(value));
  }

  delete(value: T): boolean {
    this.assertMutable();
    return this.#members.delete(this.#keyOf(value));
  }

  clear(): void {
    this.assertMutable();
    this.#members.clear();
  }

  /** Freeze membership; callers own freezing member objects and selected keys. */
  freeze(): this {
    return Object.freeze(this);
  }

  private assertMutable(): void {
    if (Object.isFrozen(this))
      throw new TypeError("Cannot modify a frozen KeyedSet");
  }

  /** Mutable copy with the same key selector. A mapper can clone member objects. */
  clone(copy: (value: T) => T = (value) => value): KeyedSet<T, K> {
    return new KeyedSet(
      this.#keyOf,
      Array.from(this, (value) => copy(value)),
    );
  }

  /** JSON contains members only; decode with the original key selector. */
  toJSON(): T[] {
    return Array.from(this);
  }

  /** Both sets must use the same key semantics; selector function identity need not match. */
  equals(other: KeyedSet<T, K>): boolean {
    if (this.size !== other.size) return false;
    for (const key of this.#members.keys()) {
      if (!other.#members.has(key)) return false;
    }
    return true;
  }

  values(): MapIterator<T> {
    return this.#members.values();
  }

  /** As with Set, keys() yields members, not the selected identity keys. */
  keys(): MapIterator<T> {
    return this.values();
  }

  *entries(): IterableIterator<[T, T]> {
    for (const value of this.values()) yield [value, value];
  }

  [Symbol.iterator](): MapIterator<T> {
    return this.values();
  }

  forEach(
    callback: (value: T, valueAgain: T, set: KeyedSet<T, K>) => void,
    thisArg?: unknown,
  ): void {
    this.#members.forEach((value) =>
      callback.call(thisArg, value, value, this),
    );
  }
}
