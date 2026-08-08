# unsaved-changes — server response contract

Purpose: an unsaved-changes guard for forms — data-dirty state + hc:dirtychange, a tab-close prompt, a boosted-navigation confirm, and clean-on-save, with zero wiring beyond one attribute.

## Required client markup

- `data-hc-dirty-guard` on the `<form>` (installDirtyGuard,
  auto-installed). Nothing else: the baseline snapshot is taken on the
  first focus inside the form, so server-rendered values are the clean
  state.
- The form's save request stays whatever it already was — this recipe
  is **client-only** and adds no endpoint. Pair it with the
  [mutating-form](../mutating-form/) contract for the save itself.

## What the guard does

| Moment | Effect |
| --- | --- |
| first `focusin` in the form | baseline snapshot (via `new FormData(form)`, so installFormat's canonical wire values are compared — display regrouping is never "dirty") |
| any `input` / `change` | compare → toggle `data-dirty` on the form, dispatch `hc:dirtychange` `{ dirty }` on flips |
| tab close / reload while dirty | the browser's generic beforeunload prompt (custom strings are ignored by modern browsers) |
| boosted `<a>` navigation while dirty | `window.confirm` with the `dirtyguard.leave` catalog message (localizable via `setMessages()`) |
| the form's own request succeeds (`htmx:afterRequest`, `detail.elt === form`, 2xx) | re-snapshot → clean |
| a request from *inside* the form but not by it (e.g. an autosave draft `<div>`) | deliberately **not** clean — a draft is not the record (see the autosave recipe) |
| native submit | never prompts (the `submit` event only fires after constraint validation passes) |

## Styling hook

`data-dirty` is a plain attribute — style it in app CSS:

```css
form[data-dirty] .unsaved-badge { visibility: visible; }
```

## Progressive enhancement (no JS)

Without JavaScript nothing guards — and nothing breaks: the form
submits natively. The guard is pure enhancement by construction.

## Accessibility

- The prompt on tab close is the browser's own dialog — fully
  accessible by definition, not styleable by design.
- `hc:dirtychange` lets apps mirror the state into text (e.g. a status
  line in an `aria-live` region) when a visual badge alone is not
  enough.

## Notes

- File inputs compare by filename.
- The boosted-nav confirm uses the native `confirm()` — synchronous by
  necessity (the navigation decision cannot wait), localized via the
  `dirtyguard.leave` message key.
