// installRangeValue — two controls, one range param on the wire.
//
//   <div data-hc-range="f-ship" role="group" aria-labelledby="ship-label">
//     <input class="hc-input" type="date" name="f-ship-from" aria-label="Ship date from">
//     <span aria-hidden="true">–</span>
//     <input class="hc-input" type="date" name="f-ship-to" aria-label="Ship date to">
//   </div>
//
//   → f-ship=2026-07-01..2026-07-31
//
// A date filter is a PERIOD, and a period is one condition: one chip in
// the applied-conditions bar, one thing to remove, one value a saved
// view stores. It is also the only shape a preset can set from a single
// control — "last month" has to write both ends, and the alternative
// (`f-ship-from` + `f-ship-to` set by a hidden input) submits a param
// nobody can see. One name, one control.
//
//   ?f-ship=2026-07-01..2026-07-31   absolute
//   ?f-ship=@month-start-1m..@month-end-1m   relative, both ends
//   ?f-ship=@month-start-1m..2026-07-15      mixed — normal in practice
//   ?f-ship=2026-07-01..                     open ended
//
// The join happens on the `formdata` event — the hook installFormat()
// and installMultiValue() already share, because htmx builds requests
// with `new FormData(form)` and a native submit builds the same entry
// list, and both fire it. Nothing here touches the network.
//
// THE NO-JS PATH IS THE `-from` / `-to` PAIR. Without JavaScript the two
// inputs submit under their own names, which is a perfectly good
// request; servers should accept both shapes. That is why the inputs
// carry real names rather than being anonymous.
//
// `from > to` IS REFUSED, never swapped: executing a different condition
// from the one written is the failure this pattern exists to prevent.
// The refusal is a native validity message on the `to` control, so the
// browser blocks the submit and htmx never issues the request. Ends that
// are not both plain (relative expressions, empty) are the server's to
// judge — it is the one that resolves them.
//
// Not to be confused with installRange(), the dual-thumb `.hc-range`
// slider — this one is about the wire.
//
// Root-delegated, idempotent, returns an uninstaller.

const KEY = '__hcRangeValueUninstall';
const GROUP = '[data-hc-range]';
const SEP = '..';

/** The two ends of a group, in DOM order, or null when the pair is incomplete. */
function endsOf(group) {
  const param = group.getAttribute('data-hc-range');
  if (!param) return null;
  const from =
    group.querySelector('[data-hc-range-from]') ??
    group.querySelector(`[name="${CSS.escape(`${param}-from`)}"]`);
  const to =
    group.querySelector('[data-hc-range-to]') ??
    group.querySelector(`[name="${CSS.escape(`${param}-to`)}"]`);
  if (!from || !to) return null;
  return { param, from, to };
}

/**
 * Split a range value into its two ends. A value without the separator
 * is a single point, which is a range whose ends are equal — that is
 * what `?f-ship=2026-07-01` means to a reader, so it is what it means
 * here.
 *
 * @param {string} value the wire value (`A..B`, `A..`, `..B`, `A`).
 * @returns {{from: string, to: string}} trimmed ends; `''` where open.
 */
export function splitRange(value) {
  const raw = String(value ?? '');
  const at = raw.indexOf(SEP);
  if (at === -1) {
    const point = raw.trim();
    return { from: point, to: point };
  }
  return {
    from: raw.slice(0, at).trim(),
    to: raw.slice(at + SEP.length).trim(),
  };
}

/**
 * Join two ends into a wire value. Both ends empty is not a condition,
 * so it joins to `''` and the caller drops the param.
 *
 * @param {string} from the lower end, or `''` for open.
 * @param {string} to the upper end, or `''` for open.
 * @returns {string} `A..B`, `A..`, `..B`, or `''`.
 */
export function joinRange(from, to) {
  const a = String(from ?? '').trim();
  const b = String(to ?? '').trim();
  if (!a && !b) return '';
  return `${a}${SEP}${b}`;
}

// Ends are only comparable when they are the same KIND of scalar.
// ISO date-ish values sort lexicographically, numbers do not ("100" <
// "20" as text), and a relative expression sorts as nothing at all —
// the server resolves those and judges them.
const ISO = /^\d{4}-\d{2}(-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?)?$/;
const CLOCK = /^\d{2}:\d{2}(:\d{2})?$/;

function kindOf(value) {
  if (!value || value.startsWith('@')) return null;
  if (ISO.test(value) || CLOCK.test(value)) return 'text';
  if (Number.isFinite(Number(value))) return 'number';
  return null;
}

/**
 * True when the ends are demonstrably the wrong way round. Anything the
 * client cannot judge as written is left to the server, which is the
 * one that resolves expressions.
 */
function reversed(a, b) {
  const kind = kindOf(a);
  if (!kind || kind !== kindOf(b)) return false;
  return kind === 'number' ? Number(a) > Number(b) : a > b;
}

/** Refuse from > to on the `to` control, so the browser blocks the submit. */
function validate(group, message) {
  const ends = endsOf(group);
  if (!ends) return;
  const { from, to } = ends;
  if (typeof to.setCustomValidity !== 'function') return;
  const bad = reversed(from.value, to.value);
  to.setCustomValidity(bad ? message : '');
  if (bad) to.setAttribute('aria-invalid', 'true');
  else if (to.getAttribute('aria-invalid') === 'true') {
    to.removeAttribute('aria-invalid');
  }
}

/**
 * Install range serialization for `[data-hc-range]` groups: the pair of
 * `-from` / `-to` controls inside one serializes as a single
 * `param=A..B` entry, in the position the first end held.
 *
 * An open end stays open (`A..`, `..B`); both ends empty contributes no
 * entry at all, because an empty condition is not a condition. A
 * reversed range is refused with a native validity message rather than
 * swapped — the request is never issued.
 *
 * The rewrite happens on the `formdata` event, which both htmx and a
 * native submit fire, so it covers both transports without wrapping
 * either. Servers should still accept the raw `-from` / `-to` pair, for
 * the path where this behavior never ran.
 *
 * @param {Document|Element} [root]
 *   The root to listen on. Defaults to the global document.
 * @param {object} [options]
 * @param {string} [options.message]
 *   The validity message shown when the ends are the wrong way round.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installRangeValue } from '@hypermedia-components/core';
 * installRangeValue();
 */
export function installRangeValue(
  root = typeof document !== 'undefined' ? document : null,
  { message = 'The end of the range is before its start.' } = {},
) {
  if (!root) return () => {};
  if (root[KEY]) return root[KEY];

  function groupsIn(form) {
    const found = [];
    for (const group of form.querySelectorAll(GROUP)) {
      const ends = endsOf(group);
      if (!ends) continue;
      if (!ends.from.name || !ends.to.name) continue;
      if (ends.from.disabled || ends.to.disabled) continue;
      found.push(ends);
    }
    return found;
  }

  function onFormData(event) {
    const form = event.target;
    const groups = groupsIn(form);
    if (groups.length === 0) return;

    // name → the range value that replaces it. Both end names map to
    // the same param, and the SECOND one is dropped, so the joined
    // value lands where the pair started.
    const joined = new Map();
    const dropped = new Set();
    for (const { param, from, to } of groups) {
      joined.set(from.name, [param, joinRange(from.value, to.value)]);
      dropped.add(to.name);
    }

    // Rebuild in place rather than delete-then-append: appending would
    // move the condition to the end, so the same conditions would
    // serialize differently depending on whether this behavior ran —
    // and a saved view compares querystrings to decide whether it has
    // been modified.
    const rebuilt = [];
    for (const [name, value] of event.formData.entries()) {
      if (dropped.has(name)) continue;
      if (!joined.has(name)) {
        rebuilt.push([name, value]);
        continue;
      }
      const [param, range] = joined.get(name);
      // An empty range contributes nothing: the condition should vanish
      // rather than arrive as `..`.
      if (range) rebuilt.push([param, range]);
    }

    const touched = new Set([
      ...rebuilt.map(([n]) => n),
      ...joined.keys(),
      ...dropped,
      ...[...joined.values()].map(([param]) => param),
    ]);
    for (const name of touched) event.formData.delete(name);
    for (const [name, value] of rebuilt) event.formData.append(name, value);
  }

  function onChange(event) {
    const group = event.target?.closest?.(GROUP);
    if (group) validate(group, message);
  }

  root.addEventListener('formdata', onFormData);
  root.addEventListener('input', onChange);
  root.addEventListener('change', onChange);

  // Server-rendered values can already be the wrong way round.
  for (const group of root.querySelectorAll?.(GROUP) ?? []) {
    validate(group, message);
  }

  const uninstall = () => {
    if (root[KEY] !== uninstall) return;
    root.removeEventListener('formdata', onFormData);
    root.removeEventListener('input', onChange);
    root.removeEventListener('change', onChange);
    delete root[KEY];
  };
  root[KEY] = uninstall;
  return uninstall;
}
