# email/panel — card container

Bordered surface box (card tokens) with a fragment slot — the email
equivalent of `hc-card` for grouping a section inside the layout.

## Fragment

`hcPanel(content)` — `content` is a fragment expression:

```html
<div th:replace="~{email/hc-email :: hcPanel(~{email/order :: summary})}"></div>
```

## Tokens

`card-bg` `card-border` `card-radius` `card-padding`.

## Notes

- Plain flavor: the slot `<div>` keeps its placeholder text — replace
  with your engine's include.
- Radius squares off in Outlook; accepted.
