# cascading-select — server response contract

Purpose: hierarchical selection (country → prefecture → city, category
→ subcategory) as **chained `<select>`s** — each level's `change` GETs
the next level's options from the server. Zero custom JavaScript:
`hc-select` + htmx. Stable under the
[markup versioning policy](../../VERSIONING.md).

## Required client markup

- Each **parent** `<select class="hc-select">` carries `data-hx-get`
  (the child-options endpoint), `data-hx-include="this"` (send my own
  value — htmx GETs do not include the enclosing form by default),
  `data-hx-target="#<child-id>"`, and `data-hx-swap="outerHTML"`.
  htmx's default `change` trigger for selects is correct — no
  `data-hx-trigger` needed.
- Each **child** level starts `disabled` with a placeholder option
  (`<option value="">Select a … first</option>`), so the chain reads
  correctly before and without JS-driven population.
- Labels via `<label for>` on every level (or `hc-field` rows, as in
  the scaffolds).

## Endpoints

| Method | URL              | Returns |
| ------ | ---------------- | ------- |
| GET    | `/areas/cities?prefecture=13` | **200** + the child `<select>` fragment (+ OOB resets for deeper levels) |

## The response

The body is the **child `<select>` re-rendered**: same `id` / `name`,
enabled, populated, and — if it has a child of its own — wired with the
same four attributes to load *its* child. When deeper levels exist,
reset each of them in the same response as an out-of-band swap
(`data-hx-swap-oob="true"`, back to the disabled placeholder), so one
response keeps the whole chain coherent:

```html
<select class="hc-select" id="city" name="city"
        data-hx-get="/areas/wards" data-hx-include="this"
        data-hx-target="#ward" data-hx-swap="outerHTML">
  <option value="">Select…</option>
  <option value="13101">Chiyoda</option>
</select>
<select class="hc-select" id="ward" name="ward" disabled data-hx-swap-oob="true">
  <option value="">Select a city first</option>
</select>
```

Choosing the empty placeholder on a parent is also a `change`: the
server receives an empty value and answers with the disabled
placeholder child (plus OOB resets), unwinding the chain.

An unknown / stale parent value is not an error: answer with the
disabled placeholder child, exactly as for the empty value.

## Progressive enhancement

Without JavaScript the chain cannot populate on the fly — render every
level server-side on the page (the form GET round trip re-renders the
page with the next level populated), or accept free-text input as the
fallback. The scaffold's plain `<form method="get">` submit path stays
functional either way: selects serialize normally.
