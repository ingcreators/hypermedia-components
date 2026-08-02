# email/footer — muted footer line

Centered muted small text with top spacing — sender identity, postal
address, unsubscribe. Place after (or at the end of) the layout's
content slot.

## Fragment

`hcFooter(text)`.

## Tokens

`color-text-muted` `font-size-sm` `font-family-sans` `space-6`.

## Notes

- `hc-em-muted` picks up the dark-mode override.
- For a link inside the footer (unsubscribe), compose `hcLink` into
  your own copy instead of this single-text fragment.
- Transactional vs. marketing legal requirements (unsubscribe link,
  address) are the application's responsibility.
