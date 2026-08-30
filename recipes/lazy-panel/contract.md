# lazy-panel — server response contract

Purpose: defer a region's content fetch until the user actually
encounters it — scroll, accordion open, or tab activation. The
intersection and `<details>` variants are purely htmx attributes; the
tab variant pairs with the `hc-tabs` behavior's `hc:tabactivated`
event.

## Required client markup

One of these trigger forms, all `once` so the fetch never repeats:

| Trigger                                  | Activated by                           |
| ---------------------------------------- | -------------------------------------- |
| `intersect once`                         | The panel scrolls into the viewport.   |
| `toggle from:closest details once`       | An ancestor `<details>` opens.         |
| `hc:tabactivated once`                   | The `hc-tabs` behavior activates the panel's tab. |
| `reveal once`                            | The panel's `hidden` attribute is removed (non-`hc-tabs` tab libraries). |

Required attributes on the panel:

- `data-hx-get="…"` — the URL that returns the panel content.
- `data-hx-trigger="…"` — one of the forms above.
- `data-hx-swap="innerHTML"` — replace the placeholder, keep the
  wrapper.

Optional:

- `data-hx-indicator="this"` to fade in a spinner / skeleton while
  the request is in flight (style via `.htmx-indicator`).

## Server response

Return the panel body HTML. No special headers required. If the
panel needs cache headers (typical for dashboards), set them as
usual:

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Cache-Control: private, max-age=60

<div class="hc-card">
  ...
</div>
```

## Failure handling

A 4xx/5xx leaves the placeholder in place by default — htmx ≥ 2 does
not swap non-2xx responses, and `HX-Reswap` alone does not override
that. The simplest way to show an error message in the same slot is a
`200` with the alert fragment as the body. To keep the real error
status, allow it first via an `htmx:beforeSwap` listener (or
`htmx.config.responseHandling`), then steer the swap with
`HX-Reswap: innerHTML`:

```http
HTTP/1.1 503 Service Unavailable
HX-Reswap: innerHTML

<p class="hc-alert" data-variant="error" role="alert">
  Reports are temporarily unavailable. Refresh in a minute.
</p>
```

## Combined with toast

Server can also signal a toast in the same response by adding
`HX-Trigger` — useful for non-fatal warnings ("data is stale").

```http
HX-Trigger: {"hc:toast":{"message":"Data may be up to 5 minutes old","variant":"warning"}}
```
