# network-retry — client contract

Purpose: surface the request that got no answer at all — offline, a dropped socket, a declared timeout — with a working Retry. This is the one error with no server response to narrate with, so unusually for a recipe, the contract here is a *client* contract.

## Why this recipe has JavaScript

"The server is the validator and the narrator"
(fundamentals/errors) — but `htmx:sendError` and `htmx:timeout` carry
no server fragment, no status, nothing to swap. The kit's exception
for client-composed strings is the i18n catalog (`dirtyguard.leave`,
`combobox.error`), and this behavior follows it:
`networkRetry.failed` / `networkRetry.retry`, overridable per host
via `data-hc-network-retry-message` / `data-hc-network-retry-label`.

## Required markup

```html
<div data-hc-network-retry></div>
```

- **One host per page**, client-owned, **empty in source** — the
  behavior renders into it; the server never does.
- Place it outside your swap targets: a swap that replaces the host
  wipes the banner (and the checks flag it).
- The behavior gives the rendered alert `role="status"` — do not put
  `aria-live` on the host yourself.

## Timeouts are declared, not defaulted

```html
<form data-hx-post="/orders" data-hx-request='{"timeout": 10000}'>…</form>
```

or globally: `htmx.config.timeout = 10000` (a `<meta name="htmx-config">`
works too). Without a declared timeout only hard send failures fire —
that is htmx's stance and this recipe keeps it.

## The behavior (`installNetworkRetry()`, auto-init)

| Event | Reaction |
| --- | --- |
| `htmx:sendError` / `htmx:timeout` | remember the failed `requestConfig` (one slot, latest wins) and render the retry alert into the host — re-rendered in place on repeat failures, never stacked |
| Retry click | re-issue via `htmx.ajax(verb, path, { source })` if the source element is still connected (vanished requester: clear, replay nothing) |
| `htmx:afterRequest` with a real `xhr.status` on the failed element | clear the alert and the slot — any actual response, success **or error**, means "didn't reach the server" is no longer true; error responses belong to the [errors map](../../apps/docs/src/content/docs/fundamentals/errors.mdx) |

- **A retry is a fresh attempt, not a byte replay**: no `values`
  override is passed, so the request re-collects its inputs at click
  time. The user may have fixed something in the meantime; the
  request that goes out is the request they would make now.
- **Never auto-retries.** Retrying is the user's verb — auto-retrying
  a POST without asking is how double orders happen. Pollers
  (`every …`) self-heal by their next tick anyway; their real
  response clears their own banner.
- One slot means concurrent failures keep only the latest — the
  session-expiry stance, documented not hidden.

## Retry × idempotency-key

The marquee composition. "Did my first click get through before the
network died?" — with an [idempotency-key](../idempotency-key/)
hidden field in the form, the answer is safe either way: the retried
POST carries the **same key** (re-collected with the other inputs),
so if the original request did commit and only the response was lost,
the retry gets the original response replayed. Without the key, a
retried POST is a genuine double-submit risk — pair them.

## Endpoints

None of its own — this recipe attaches to whatever requests the page
already makes. The demo's `/save?down=1` flavour just sleeps past the
declared timeout to make the failure reproducible.

## Progressive enhancement

JS-off means htmx-off means full-page navigations — the browser's own
network-error page is the handler, and it has its own reload button.
The host stays empty and invisible.

## Accessibility

The rendered alert is `role="status"` (polite): the user just acted
and is looking at the page; a polite announcement names the failure
without seizing focus. The Retry button is a real `<button>` reached
in normal tab order. Repeat failures re-render the same alert rather
than stacking new ones.

## Notes

- 4xx/5xx are *not* this recipe's business: a response arrived, the
  [errors map](../../apps/docs/src/content/docs/fundamentals/errors.mdx)
  routes it. That includes the retry's own outcome.
- `navigator.onLine` is deliberately unused — it lies in both
  directions; the only honest signal is a request that failed.
- The FormData multi-value caveat from session-expiry does not apply
  here (no values are passed), but the one-slot latest-wins rule does.
