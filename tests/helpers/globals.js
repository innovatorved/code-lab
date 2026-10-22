'use strict';

/**
 * Global stubs for suites that simulate browser APIs.
 *
 * `globalThis.navigator` is a getter-only accessor from Node 21 onwards, so the
 * historical `globalThis.navigator = { ... }` throws
 * `TypeError: Cannot set property navigator of #<Object> which has only a getter`.
 * Always go through `setNavigator()` / `defineGlobal()` instead.
 */

/**
 * Define (or redefine) a property on the global object.
 * @param {string} name
 * @param {unknown} value
 * @returns {() => void} restore function
 */
function defineGlobal(name, value) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, name);
  const previous = had ? Object.getOwnPropertyDescriptor(globalThis, name) : undefined;
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
    enumerable: previous ? previous.enumerable !== false : true
  });
  return () => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete globalThis[name];
  };
}

/**
 * Replace `globalThis.navigator` with a stub.
 *
 * Replacement (not merge) semantics: suites need to model "clipboard is
 * missing", which a merge would silently preserve from the previous stub.
 * @param {Record<string, unknown>} [stub]
 * @returns {{ navigator: any, restore: () => void }}
 */
function setNavigator(stub = {}) {
  const value = Object.assign({}, stub);
  const restore = defineGlobal('navigator', value);
  return { navigator: value, restore };
}

module.exports = { defineGlobal, setNavigator };
