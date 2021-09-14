/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Copyright (C) Oliver Lenehan, 2021 */

/** A wrapper to represent namespaced keys in a `Storage` instance (typically either `localStorage` or `cacheStorage`). */
class NamespacedStorage<K extends string> {

  /** A wrapper to represent namespaced keys in a `Storage` instance (typically either `localStorage` or `cacheStorage`).  
   * + `store` is the `Storage` instance to apply namespacing to.  
   * + `namespace` represents the `prefix::` applied to create the appearance of namespaces. */
  constructor(private store: Storage, private namespace: string) {}

  /** Set a `namespace::key` to `value`. */
  set(key: K, value: string) {
    this.store.setItem(`${this.namespace}::${key}`, value);
  }

  /** Set a `namespace::key` to `value`, only if it doesn't already exist (think defaults).
   * Returns true if the value was missing, and thus set. */
  setIfNull(key: K, value: string): boolean {
    if (this.get(key) == null) {
      this.set(key, value);
      return true;
    } else {
      return false;
    }
  }

  /** Get the value of `namespace::key`. */
  get(key: K): string | null {
    return this.store.getItem(`${this.namespace}::${key}`);
  }

  /** Delete the entry for `namespace::key`. */
  delete(key: K): void {
    this.store.removeItem(key);
  }

  /** Flush all `namespace::*` entries. */
  clear(): void {
    const keys: string[] = [];
    const storeSize = this.store.length;
    for (let i = 0; i < storeSize; ++i) {
      const k = this.store.key(i)!;
      if (k.startsWith(`${this.namespace}::`)) {
        keys.push(k);
      }
    }
    for (const k of keys) {
      this.store.removeItem(k);
    }
  }

}
