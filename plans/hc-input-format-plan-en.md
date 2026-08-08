# input-format — formatted numbers, fullwidth normalization, input masks, postal-address recipe

Status: **proposed.**
First theme of the business-app gap analysis (2026-08-08): the input
layer between "native constraint validation" (already shipped:
`installValidation` / `installFieldErrors`) and "what business forms
actually receive from users" — grouped amounts, fullwidth digits typed
through an IME, fixed-format codes (postal, phone, product codes), and
the postal→address flow every Japanese business form repeats. Three
small behaviors plus one recipe; no network code anywhere (htmx owns
the one request in the recipe).

## 1. Goal

```html
<!-- Amount: displays 1,234,567 — submits 1234567 -->
<div class="hc-field">
  <label class="hc-field__label" for="amount">Amount</label>
  <div class="hc-input-group">
    <span class="hc-input-group__addon">¥</span>
    <input class="hc-input" id="amount" name="amount" type="text"
           inputmode="numeric" autocomplete="off"
           data-hc-format="number" value="1234567">
  </div>
</div>

<!-- Product code: fullwidth typing self-corrects on blur -->
<input class="hc-input" name="sku" data-hc-normalize="ascii">

<!-- Postal code: mask + address lookup (recipe) -->
<input class="hc-input" name="postal" inputmode="numeric"
       placeholder="123-4567" data-hc-mask="postal-jp"
       data-hx-get="/address-by-postal"
       data-hx-trigger="change[target.value.length==8]"
       data-hx-target="#postal-result">
```

Typing `１２３４５６７` into the amount field (IME fullwidth) blurs to
`1,234,567`; the server receives `amount=1234567` on both the htmx and
the native submit path. No JS → the raw typed value submits and the
server validates (it is the validator anyway).

## 2. Verified facts the design stands on

- **htmx builds request parameters with `new FormData(form)`** (one
  occurrence in the vendored 2.0.4 bundle). Per WHATWG, constructing
  `FormData(form)` fires the **`formdata` event** on the form — the
  same event native submission fires when it builds the entry list.
  Consequence: one root-delegated `formdata` listener rewrites the wire
  value for **both** transports; behaviors never touch the network.
- The `formdata` event bubbles. jsdom implements `FormData` but does
  **not** fire the event on `new FormData(form)` (no `FormDataEvent`
  constructor either) — unit tests dispatch a synthetic event to pin
  the handler, and a cross-engine Playwright spec pins the real firing
  (fixture snapshots `new FormData(form)` into the DOM).
- **IME safety**: `input` events during composition carry
  `isComposing: true`, and `blur` commits any open composition first.
  Format-on-blur therefore never fights the IME; live masking skips
  composition events and runs once on `compositionend`.
- `String.prototype.normalize('NFKC')` already maps fullwidth ASCII
  (`０-９Ａ-Ｚ`) to halfwidth and halfwidth kana (`ﾃﾞ`) to fullwidth
  (`デ`) — the normalization core is the platform, plus two small
  additions: U+3000 → space (ascii mode) and the hiragana→katakana
  shift (kana mode).
- `type="text"` + `inputmode="numeric"` is the blessed numeric input
  (docs will say why): `type="number"` rejects grouped values, drops
  leading zeros, and scroll-wheels the value — all wrong for amounts
  and codes.
- `hc-input-group` (shipped) supplies currency prefixes/suffixes in
  CSS only — `installFormat` needs no currency mode.

## 3. The behaviors

All three: root-delegated, idempotent installers returning
uninstallers, state in attributes, no i18n (no UI text), registered in
`behaviors.js` auto-init + `index.js` exports + `bundle-js.mjs` FILES.

### 3.1 `installFormat()` — `data-hc-format="number"`

New `src/js/format.js`:

- **focus** → show the raw value (strip grouping): editing never fights
  separators, so there is **no caret management at all**.
- **blur** → normalize (ascii core) → parse (`-`, digits, one `.`) →
  if parseable, write the grouped display value via
  `Intl.NumberFormat(locale, { maximumFractionDigits })`;
  unparseable input is left as typed — the server is the validator.
- **`formdata`** → replace the entry with the raw parsed value
  (display stays grouped). Covers htmx + native (§2).
- Config: `data-decimals` (max fraction digits, default 0),
  `data-locale` (default: closest `[lang]`, else `en`; grouping only —
  no currency symbols, no rounding beyond `data-decimals`).

### 3.2 `installNormalize()` — `data-hc-normalize="ascii | kana"`

Same file (`format.js` exports both; they share the NFKC core):

- **blur** → rewrite the value in place (the user sees the corrected
  value): `ascii` = NFKC + U+3000→U+0020; `kana` = NFKC + hiragana →
  katakana (U+3041–U+3096 +0x60; furigana fields).
- No `formdata` hook — the display value **is** the wire value.

### 3.3 `installMask()` — `data-hc-mask`

New `src/js/mask.js`:

- Pattern tokens: `#` digit · `a` letter · `A` letter (upcased) ·
  `*` alphanumeric; every other char is a literal. Preset alias:
  `postal-jp` → `###-####`. (No phone preset: Japanese landline
  hyphenation is not fixed-width; the docs show explicit patterns for
  the fixed-width cases instead.)
- **input** (not composing) + **compositionend** → normalize (NFKC),
  extract raw token chars in order, re-render mask, restore caret to
  "after the same count of raw chars"; overflow chars drop.
- **beforeinput** `deleteContentBackward` with the caret right after a
  literal run → hop the caret over the literals first, so backspace
  always consumes a raw char (the classic mask trap).
- Sets `maxlength` to the mask length when absent.
- Submit value = the displayed, literal-including canonical form.
  `data-hc-mask-submit="raw"` opts into stripping literals via the
  shared `formdata` hook (servers that store 7-digit postal codes).
- No-JS parity: docs recommend `pattern` + `placeholder` mirroring the
  mask; the behavior never blocks submission.

## 4. Server contract (recipe `postal-address`)

The lookup endpoint owns all address data; the client never parses
addresses. `GET /address-by-postal?postal=123-4567`:

| Case | Response (200 unless noted) |
| --- | --- |
| single hit | status fragment for `#postal-result` ("住所を入力しました" hint) **+ OOB `outerHTML` swaps** for the address inputs (`#pref`, `#city`, `#addr1` — full `<input … value="…">` elements re-rendered server-side) |
| multiple hits | a compact candidate list into `#postal-result`: each candidate is a `<button>` re-calling the same endpoint with `&choice=<n>` → single-hit response |
| not found | hint fragment into `#postal-result` ("該当する住所がありません — そのまま入力してください"); no OOB swaps |
| malformed postal | `422` + the hint fragment (htmx swaps it via the mutating-form `htmx:beforeSwap` allowance already blessed for 422) |
| no-JS | the address fields are ordinary inputs — manual entry; the lookup is pure enhancement |

Trigger contract: `change[target.value.length==8]` on the masked input
(the mask guarantees `123-4567` is the only 8-char value). A visible
「住所検索」 button variant (`data-hx-get` on a button with
`data-hx-include`) is documented for forms that prefer an explicit
affordance.

OOB-swapping the inputs replaces user-typed values **by design**
(that is what autofill means); the fragment re-renders the inputs with
their classes and ids intact so htmx re-initialization is a no-op.

## 5. checks.json (postal-address)

`detect: input[data-hc-mask][data-hx-get]` — rules: `#postal-result`
target exists (**error**); OOB ids referenced by the contract exist in
the form (**error**); trigger has a `change` guard, not bare `keyup`
(**warn**); masked input has `inputmode="numeric"` + `placeholder`
(**warn**).

## 6. Public API surface

Additive → patch: 3 exports (`installFormat`, `installNormalize`,
`installMask`), attributes `data-hc-format`, `data-hc-normalize`,
`data-hc-mask`, `data-hc-mask-submit` (+ generic config `data-decimals`,
`data-locale`), 1 recipe contract. No new events (native `input` /
`change` semantics preserved), no CSS, no i18n keys.

## 7. PR split (sequential, no stacking)

### PR 1 — `chore(plans)`: this document.

### PR 2 — `feat(behaviors): number formatting + fullwidth normalization (installFormat, installNormalize)`
- [ ] `src/js/format.js` + registration (behaviors / index /
      bundle-js FILES / build-manifest `EXPLICIT_CLAIMS: 'platform'`)
      + `types.smoke.ts` entries.
- [ ] `test/format.test.mjs`: fullwidth parse, grouping by locale,
      decimals padding, focus-raw/blur-grouped round-trip, **formdata
      rewrite on both `new FormData(form)` and submit**, unparseable
      passthrough, ascii/kana normalize modes, idempotent, uninstall.
- [ ] Docs: `components/input` (en+ja) — "Numeric & formatted input"
      section (why not `type=number`, input-group currency example) +
      `reference/behaviors` rows (en+ja, count bump).
- [ ] CHANGELOG.

### PR 3 — `feat(behaviors): declarative input masks (installMask)`
- [ ] `src/js/mask.js` + registration (as PR 2) + `types.smoke.ts`.
- [ ] `test/mask.test.mjs`: token classes, literals, caret math
      (set/read `selectionStart`), backspace-over-literal, paste,
      overflow drop, NFKC entry, `postal-jp` alias, `submit="raw"`
      formdata strip, maxlength defaulting, idempotent, uninstall.
- [ ] Browser spec `test-browser/mask.spec.mjs` + fixture: real typing
      through the mask + caret position + axe.
- [ ] Docs: `components/input` (en+ja) — "Input masks" section +
      `reference/behaviors` rows (en+ja, count bump).
- [ ] CHANGELOG.

### PR 4 — `docs(recipes): bless postal-address (mask + lookup + OOB autofill)`
- [ ] `recipes/postal-address/{recipe,expanded,contract,checks}` +
      `recipes/README.md` row + docs page (en+ja, incl. live demo via
      `recipe-demos/` frame) + `recipes/index.mdx` rows (en+ja; the
      sidebar autogenerates).
- [ ] Demo API route: hardcoded table incl. one multi-hit code and the
      not-found path.
- [ ] `test-browser/postal-address.spec.mjs`: lookup fills the inputs,
      multi-hit list picks, not-found hint, axe.
- [ ] CHANGELOG; plan Status → shipped.

## 8. Risks / notes

- **`formdata` interception is load-bearing** — if a future htmx major
  stops constructing `FormData(form)`, the wire value falls back to the
  displayed one; the unit suite pins the current truth and the contract
  documents raw-on-the-wire as the guarantee.
- Live mask caret restoration is the only caret math in the theme
  (format deliberately avoids it via focus-raw). The jsdom caret tests
  cover the arithmetic; the browser spec covers real key events.
- `installNormalize` rewriting on blur can surprise a user who wanted
  fullwidth in an `ascii` field — the attribute is opt-in per field;
  docs say "put it only on fields whose wire format is ASCII".
- Locale default `en` (not `ja`) when no `[lang]` exists mirrors
  `Intl` defaults; docs tell Japanese sites to set `<html lang="ja">`
  (they already must for fonts).
