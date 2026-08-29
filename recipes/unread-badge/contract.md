# unread-badge — server response contract

Purpose: the notification count in app chrome — server-owned, poll-freshened, corrected out-of-band by the user's own actions, and honest at zero.

## The fragment is the nav item, not the badge

The count and the accessible name must change together, so the swap
unit is the element that carries both:

```html
<a class="hc-button" data-variant="ghost" href="/notifications"
   id="unread-nav" data-hc-unread aria-label="Notifications, 3 unread"
   data-hx-get="/notifications/badge" data-hx-trigger="every 60s"
   data-hx-target="this" data-hx-swap="outerHTML">
  Notifications
  <span class="hc-badge" data-variant="info" aria-hidden="true">3</span>
</a>
```

- The `hc-badge` is `aria-hidden` **presentation** — the truth a
  screen reader gets is the nav item's `aria-label`, and both are
  rendered from the same server count in the same fragment.
- `data-hc-unread` is a **contract marker only** — no behavior
  attaches; `hc validate` uses it to check the fragment.
- The `id` is required: it is the anchor every out-of-band correction
  swaps against.

## The polling shape

The fragment polls **itself** — the
[async-job](../async-job/contract.md) self-swap rule:

1. `data-hx-target="this"` + `data-hx-swap="outerHTML"`: the polling
   attributes travel with the fragment, so the server owns the
   cadence (back off by writing `every 300s` into the fragment it
   returns under load; stop entirely by omitting the trigger).
2. An `innerHTML` swap would strand the old trigger on the surviving
   element — the classic poll-forever defect.
3. The polled URL is cheap by design: one count query, no list
   rendering.

## Count rendering rules

| Count | Badge | Accessible name |
| --- | --- | --- |
| 0 | **absent** — silence, not a grey "0" | `Notifications` |
| 1 … cap | the number | `Notifications, 3 unread` |
| > cap | `99+` (the declared cap) | `Notifications, more than 99 unread` |

Display and accessible name always tell the same truth. The cap is
the server's declared policy (99 is customary; the demo uses 9 so the
state is reachable). `hc-badge` sets `tabular-nums`, so in-place
count changes don't shift the layout.

## Never a live region

The fragment must not carry `aria-live` (nor `role="status"`): a
count ticking up in app chrome would interrupt a screen-reader user
mid-task on every poll. The count is discovered on focus/navigation,
like sighted users discover it by glancing. If an *arrival* deserves
an announcement, that is the event's own toast
([sse-toast](../sse-toast/)) — the badge's job is state, not news.

## The anti-drift rule: your own actions correct the badge out-of-band

Any response to an action that **changes unread state** — opening an
item, mark-one-read, mark-all-read — carries the re-rendered nav
fragment with `data-hx-swap-oob="outerHTML"` alongside its normal
payload. The next poll merely confirms it. The defect this rule
exists for: the user reads everything and the badge says 3 until the
minute ticks over.

## Endpoints

| Method | URL | Returns |
| --- | --- | --- |
| GET | `/notifications/badge` | **200** + the current nav fragment (one of the three states) |
| GET | `/notifications` | the list page/fragment — a plain navigation; render the current fragment in the chrome as usual |
| POST | `/notifications/read-all` | **200** + the list re-rendered read, **plus the zeroed nav fragment out-of-band** |

## SSE variant

On a page with an [sse-updates](../sse-updates/) scope, the same OOB
fragment rides any event's `data:` payload — the sse-updates page
shows a badge doing exactly this. Polling stays the base shape here
because it needs no extension; the fragment contract is identical
either way.

## Progressive enhancement

The fragment is a real `<a href="/notifications">` — JS-off means the
badge is as fresh as the last full page render, and the link still
works. No-JS responses to the list URL render a full page.

## Accessibility

- The accessible name lives on the interactive element
  (`aria-label` on the `<a>`); the badge is `aria-hidden`.
- Zero renders no badge — nothing to skip past.
- No `aria-live` anywhere in the fragment (see above).
- The badge's `data-variant="info"` is colour *plus* the count text —
  never colour alone.

## Notes

- Poll cadence is a product decision the server re-declares on every
  response; 60s is a sane default for chrome counts.
- The count query must be cheap (an indexed `WHERE read_at IS NULL`
  count) — it will run every minute per open tab.
- Multiple tabs each poll and each converge; OOB corrections apply to
  the tab that acted, the others catch up on their next tick.
