// format behaviors — business-form input hygiene, no network, no UI text.
//
// installFormat() — grouped numeric display with a raw wire value:
//
//   <div class="hc-input-group">
//     <span class="hc-input-addon">¥</span>
//     <input class="hc-input" name="amount" type="text" inputmode="numeric"
//            data-hc-format="number" value="1,234,567">
//   </div>
//
//   - focus shows the raw editable value (no grouping — and therefore no
//     caret management anywhere in this behavior),
//   - blur normalizes fullwidth digits (NFKC), parses, and writes the
//     grouped display value via Intl.NumberFormat,
//   - the `formdata` event rewrites the entry to the raw canonical value
//     ("1234567"). htmx builds requests with `new FormData(form)` and the
//     native submit builds the same entry list, and both fire `formdata` —
//     one hook covers both transports. The server always receives the raw
//     value; the grouped form is presentation only.
//
//   `data-decimals` pads to a minimum number of fraction digits (never
//   rounds — the server is the validator); `data-locale` overrides the
//   grouping locale (default: closest `[lang]`, else `en`). The initial
//   display value is server-rendered — render it grouped if you want it
//   grouped before first blur.
//
// installNormalize() — IME leftovers self-correct on commit:
//
//   <input class="hc-input" name="sku" data-hc-normalize="ascii">
//
//   `ascii` maps fullwidth ASCII to halfwidth (NFKC) and the ideographic
//   space to a plain space; `kana` maps halfwidth kana to fullwidth and
//   hiragana to katakana (furigana fields). The rewrite happens in a
//   capture-phase `change` listener so htmx triggers reading
//   `target.value` see the normalized value, plus a `formdata` safety net.
//
// Both installers are root-delegated, idempotent, and return uninstallers.
// State lives in the attributes; the behaviors never touch the network.

const FORMAT_KEY = '__hcFormatUninstall';
const NORMALIZE_KEY = '__hcNormalizeUninstall';
const FORMAT_SEL = 'input[data-hc-format="number"]';
const NORMALIZE_SEL = '[data-hc-normalize]';

const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000);

function toAscii(value) {
  return value.normalize('NFKC').split(IDEOGRAPHIC_SPACE).join(' ');
}

function toKana(value) {
  return value
    .normalize('NFKC')
    .replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}

function normalizeValue(el) {
  const mode = el.getAttribute('data-hc-normalize');
  if (mode === 'ascii') return toAscii(el.value);
  if (mode === 'kana') return toKana(el.value);
  return el.value;
}

function localeOf(el) {
  return (
    el.getAttribute('data-locale') ||
    el.closest('[lang]')?.getAttribute('lang') ||
    'en'
  );
}

const separatorCache = new Map();

// The locale's group / decimal characters, from the formatter itself —
// never guessed (nbsp and narrow-nbsp groupers exist).
function separatorsOf(locale) {
  let seps = separatorCache.get(locale);
  if (!seps) {
    const parts = new Intl.NumberFormat(locale).formatToParts(11111.1);
    seps = {
      group: parts.find((p) => p.type === 'group')?.value ?? ',',
      decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    };
    separatorCache.set(locale, seps);
  }
  return seps;
}

// Raw canonical value ("-1234.5") or null when the input is not a plain
// number. Strings throughout — amounts must not round-trip through
// floating point.
function parseNumeric(value, locale) {
  const { group, decimal } = separatorsOf(locale);
  let v = toAscii(value).trim();
  v = v.split(group).join('');
  v = v.replace(/\s/g, '');
  if (decimal !== '.') v = v.split(decimal).join('.');
  if (!/^-?\d+(\.\d+)?$/.test(v)) return null;
  return v;
}

function decimalsOf(el) {
  const raw = Number.parseInt(el.getAttribute('data-decimals') ?? '', 10);
  if (Number.isNaN(raw)) return 0;
  return Math.min(Math.max(raw, 0), 20);
}

function formatNumeric(canonical, locale, minDecimals) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: 20,
  }).format(canonical);
}

// Multiple same-name controls make FormData.set() ambiguous — leave those
// entries alone (the server validates anyway).
function soleOwnerOfName(form, el) {
  let count = 0;
  for (const other of form.elements) {
    if (other.name === el.name) count += 1;
  }
  return count === 1;
}

/**
 * Install grouped numeric input formatting for
 * `input[data-hc-format="number"]`: raw value while focused, grouped
 * display on blur, and the raw canonical value on the wire (the `formdata`
 * event covers both the htmx and the native submit path). Configure with
 * `data-decimals` (minimum fraction digits, padding only) and
 * `data-locale` (default: closest `[lang]`, else `en`).
 *
 * @param {Document|Element} [root]
 *   The root to listen on. Defaults to the global document.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installFormat } from '@hypermedia-components/core';
 * installFormat();
 */
export function installFormat(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[FORMAT_KEY]) return root[FORMAT_KEY];

  function onFocusIn(event) {
    const el = event.target;
    if (!el.matches?.(FORMAT_SEL)) return;
    const locale = localeOf(el);
    const canonical = parseNumeric(el.value, locale);
    if (canonical == null) return;
    // Editing view: no grouping, the locale's own decimal character.
    el.value = canonical.replace('.', separatorsOf(locale).decimal);
  }

  function onFocusOut(event) {
    const el = event.target;
    if (!el.matches?.(FORMAT_SEL) || el.value === '') return;
    const locale = localeOf(el);
    const canonical = parseNumeric(el.value, locale);
    if (canonical == null) return;
    el.value = formatNumeric(canonical, locale, decimalsOf(el));
  }

  function onFormData(event) {
    const form = event.target;
    for (const el of form.elements) {
      if (!el.matches?.(FORMAT_SEL) || !el.name || el.disabled) continue;
      const canonical = parseNumeric(el.value, localeOf(el));
      if (canonical == null || !soleOwnerOfName(form, el)) continue;
      event.formData.set(el.name, canonical);
    }
  }

  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  root.addEventListener('formdata', onFormData);

  const uninstall = () => {
    if (root[FORMAT_KEY] !== uninstall) return;
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('focusout', onFocusOut);
    root.removeEventListener('formdata', onFormData);
    delete root[FORMAT_KEY];
  };
  root[FORMAT_KEY] = uninstall;
  return uninstall;
}

/**
 * Install input normalization for `[data-hc-normalize]` controls:
 * `ascii` maps fullwidth ASCII to halfwidth and the ideographic space to
 * a plain space; `kana` maps halfwidth kana to fullwidth and hiragana to
 * katakana. Rewrites happen on `change` (capture phase, so downstream
 * listeners read the normalized value) with a `formdata` safety net.
 *
 * @param {Document|Element} [root]
 *   The root to listen on. Defaults to the global document.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installNormalize } from '@hypermedia-components/core';
 * installNormalize();
 */
export function installNormalize(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[NORMALIZE_KEY]) return root[NORMALIZE_KEY];

  function onChange(event) {
    const el = event.target;
    if (!el.matches?.(NORMALIZE_SEL)) return;
    const normalized = normalizeValue(el);
    if (normalized !== el.value) el.value = normalized;
  }

  function onFormData(event) {
    const form = event.target;
    for (const el of form.elements) {
      if (!el.matches?.(NORMALIZE_SEL) || !el.name || el.disabled) continue;
      const normalized = normalizeValue(el);
      if (normalized === el.value || !soleOwnerOfName(form, el)) continue;
      event.formData.set(el.name, normalized);
    }
  }

  root.addEventListener('change', onChange, true);
  root.addEventListener('formdata', onFormData);

  const uninstall = () => {
    if (root[NORMALIZE_KEY] !== uninstall) return;
    root.removeEventListener('change', onChange, true);
    root.removeEventListener('formdata', onFormData);
    delete root[NORMALIZE_KEY];
  };
  root[NORMALIZE_KEY] = uninstall;
  return uninstall;
}
