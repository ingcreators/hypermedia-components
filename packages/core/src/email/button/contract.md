# email/button — bulletproof button

Table-cell button: `bgcolor` + inline background on the `<td>`, padded
`<a>` inside. Whole visible area is clickable in every client without
VML.

## Fragments

- `hcButton(href, label)` — primary variant.
- `hcButtonSecondary(href, label)` — secondary variant.

```html
<div th:replace="~{email/hc-email :: hcButton(${orderUrl}, '注文を確認する')}"></div>
```

`label` is escaped by `th:text`; `href` goes through `th:href` (use
absolute URLs).

## Tokens

`button-primary-bg/fg/border` (or `button-secondary-*`)
`button-radius` `button-padding-x` `button-font-size`
`button-font-weight` `font-family-sans` `space-3`.

## Client notes

- Outlook (Word engine) ignores `border-radius` → square corners;
  accepted degradation.
- Only the `<a>` is clickable in Outlook (the td padding is not) —
  padding lives on the `<a>` for that reason.
- Plain flavor: static `href`/label placeholders remain; interpolate
  and **escape the label** in your engine.
