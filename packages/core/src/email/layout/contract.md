# email/layout — document shell

Full HTML document: preheader, full-width background, centered 600px
card (surface, border, radius) holding the content slot. The generated
`hc-email-layout.html` has the `styles` partial baked into `<head>`
(the `<!--hc:styles-->` marker).

## Fragment

`hcLayout(title, preheader, content)` — `title`/`preheader` are text
(escaped by `th:text`); `content` is a fragment expression
(`~{template :: fragment}`).

```html
<div th:replace="~{email/hc-email-layout :: hcLayout('注文確認', 'ご注文が確定しました', ~{email/order :: body})}"></div>
```

## Tokens

`color-bg` `color-surface` `color-border` `card-radius` `space-3`
`space-6` `space-8`; dark: `color-bg` `color-surface` `color-border`.

## Client notes

- Outer + inner `role="presentation"` tables; `bgcolor` attributes back
  up the inline `background-color` for old Outlook.
- Preheader div is hidden via `display:none` + `max-height:0` +
  `mso-hide:all` — the standard triple.
- Mobile: `.hc-em-container` drops to 100% width, `.hc-em-pad`
  tightens padding (styles partial; enhancement-only).
- Plain flavor: the `th:replace` slot div remains with placeholder
  text — replace it with your engine's include. Escape `title` /
  `preheader` yourself.
