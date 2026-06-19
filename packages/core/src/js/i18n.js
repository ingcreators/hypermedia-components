// @hypermedia-components/core — i18n message catalog.
//
// Behaviors inject a handful of user-facing strings that the server can't
// author (created DOM nodes, default ARIA labels). This module is the
// single place those defaults live, so an app can translate the whole kit
// at once instead of patching each behavior.
//
// Resolution order, highest priority first:
//   1. A per-element attribute the author/server wrote (e.g. an existing
//      `aria-label`, or a `data-hc-*` override). Behaviors check this first.
//   2. The global catalog set via `setMessages()` — the app-wide locale.
//   3. The built-in English default below.
//
// Set the locale once at startup, before installing behaviors:
//
//   import { setMessages, installCombobox } from '@hypermedia-components/core';
//   setMessages({ 'combobox.empty': '一致なし', 'confirm.cancel': 'キャンセル' });
//   installCombobox();
//
// Keys are namespaced by behavior. Values may contain `{name}` placeholders
// interpolated from the `params` passed to `t()`.

export const DEFAULT_MESSAGES = Object.freeze({
  'combobox.empty': 'No matches',
  'combobox.loading': 'Loading…',
  'combobox.error': 'Couldn’t load options',
  'combobox.create': 'Create “{value}”',
  'multicombobox.empty': 'No matches',
  'multicombobox.create': 'Add “{value}”',
  'multicombobox.remove': 'Remove {label}',
  'calendar.label': 'Calendar',
  'calendar.prevMonth': 'Previous month',
  'calendar.nextMonth': 'Next month',
  'calendar.month': 'Month',
  'calendar.year': 'Year',
  'confirm.message': 'Continue?',
  'confirm.title': 'Confirm',
  'confirm.confirm': 'Confirm',
  'confirm.cancel': 'Cancel',
  'fieldErrors.unknown': 'Invalid value',
  'copy.ok': 'Copied',
  'shell.toggleNav': 'Toggle navigation',
  'shell.collapseNav': 'Collapse sidebar',
  'splitter.resize': 'Resize panels',
  'themeToggle.label': 'Switch color theme',
  'toast.label': 'Notifications',
});

// The dist bundles (hc.min.js, hc.behaviors.min.js) each inline a copy of
// this module, so module-level state would be one catalog per bundle —
// setMessages() through one entry would never reach behaviors loaded from
// another (#216). The catalog lives on a globalThis-keyed singleton instead,
// so every copy reads and writes the same state.
const STATE_KEY = Symbol.for('hypermedia-components.i18n');
const state =
  globalThis[STATE_KEY] || (globalThis[STATE_KEY] = { messages: { ...DEFAULT_MESSAGES } });

/**
 * Merge translations into the global catalog. Pass a flat `{ key: value }`
 * map; unknown keys are ignored at read time. Returns a function that
 * restores the catalog to its prior state (handy for tests and scoped
 * overrides).
 *
 * @param {Record<string, string>} overrides
 * @returns {() => void} restore
 */
export function setMessages(overrides) {
  const prev = state.messages;
  state.messages = { ...state.messages, ...(overrides || {}) };
  return () => {
    state.messages = prev;
  };
}

/**
 * Reset the catalog to the built-in English defaults.
 */
export function resetMessages() {
  state.messages = { ...DEFAULT_MESSAGES };
}

/**
 * A snapshot of the current catalog (defaults merged with overrides).
 *
 * @returns {Record<string, string>}
 */
export function getMessages() {
  return { ...state.messages };
}

/**
 * Whether the catalog can resolve `key` (built-in default or a
 * `setMessages()` override) — as opposed to `t()` falling back to the key
 * itself. Lets callers distinguish "translated" from "unknown key" (e.g.
 * `installFieldErrors` resolving server message keys).
 *
 * @param {string} key
 * @returns {boolean}
 */
export function hasMessage(key) {
  return state.messages[key] != null || DEFAULT_MESSAGES[key] != null;
}

/**
 * Resolve a catalog key, interpolating `{name}` placeholders from `params`.
 * Falls back to the built-in default, then to the key itself, so a missing
 * translation degrades to readable text rather than throwing.
 *
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 * @returns {string}
 */
export function t(key, params) {
  let str = state.messages[key];
  if (str == null) str = DEFAULT_MESSAGES[key];
  if (str == null) str = key;
  if (params) {
    str = str.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
    );
  }
  return str;
}
