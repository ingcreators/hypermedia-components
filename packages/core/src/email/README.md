# Email fragment sources

Source-format scaffolds for the HTML-email render target
([plan](../../../../plans/hc-email-templates-plan-en.md)). Consumed by
the docs theme builder's Email tab and the CLI's `email eject` through
`scripts/email-transform.mjs`; never shipped to a browser at runtime.

## Conventions

- Each `<name>/fragment.html` is a **Thymeleaf natural template**:
  valid plain HTML with `th:fragment` signatures and `th:text` /
  `th:href` / `th:each` slots over visible placeholder content. The
  **plain flavor** is the same file with every `th:*` attribute
  stripped; other template engines take that and re-add their own slot
  syntax.
- Inline styles reference tokens by **flat name** (the `--hc-*` custom
  property name minus the prefix): `{button-primary-bg}`. Generation
  resolves them to literals via `resolveTokens` and converts rem → px
  (16px root). `{name.dark}` reads the dark map — allowed only in the
  `styles` partial.
- **Hybrid rendering strategy**: inline styles are the load-bearing
  baseline (they survive every client, forwarding included); the
  `styles` partial is enhancement-only (mobile width, dark mode) and
  must remain safe to strip. Never move a load-bearing declaration into
  the partial.
- **Email-safe CSS only** — the guard test (`test/email.test.mjs`)
  enforces a property allowlist over every generated `style`
  attribute and the partial. No flex/grid/position, no `var()`, no
  rem/em in output.
- Layout skeletons are `role="presentation"` tables, 600px container.
  No VML / `mso-*` conditionals (Outlook's Word engine renders square
  corners — accepted degradation, noted per contract).
- **Escaping**: in the Thymeleaf flavor, `th:text` escapes for you. In
  the plain flavor the slot content is whatever your engine interpolates
  — escaping is the application's responsibility, called out in every
  contract.
- Authoring rules the strip regex relies on: `th:*` attribute values
  never contain `"` or `>`; no `th:block` elements (attributes only).

## Client baseline

Verified against the usual matrix: Gmail (web/app, Google accounts),
Apple Mail, Outlook.com, Outlook Windows (Word engine), Yahoo. The
Gmail app reading non-Google (IMAP/POP) accounts drops `<head>` styles
— that case runs on the inline baseline alone. `prefers-color-scheme`
dark overrides work in Apple Mail/Outlook macOS; Gmail ignores them and
applies its own auto-invert.
