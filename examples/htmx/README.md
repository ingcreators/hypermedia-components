# htmx example

A self-contained demo of the four core htmx recipes against a tiny
Node API. The server keeps three items in memory and replies with
HTML fragments and `HX-Trigger` headers — the canonical hypermedia
shape.

## Run

```bash
cd examples/htmx
pnpm start
```

This runs `prestart` (which builds `@hypermedia-components/core`) and
then starts a zero-dependency Node server on
[http://localhost:4323/](http://localhost:4323/). The server aliases
`/hc.css`, `/hc.behaviors.js`, etc. to the workspace `dist`, and
loads htmx from `unpkg.com` via CDN.

Set `PORT` to use a different port:

```bash
PORT=5001 pnpm start
```

> Examples are not part of the pnpm workspace; pnpm still finds the
> workspace root when resolving `--filter`. Run `node server.mjs`
> directly if you want to skip the auto-build.

## What the page demonstrates

- **Live search** — input with
  `data-hx-trigger="input changed delay:200ms, search"` filters the
  items table.
- **Items table with confirm-action** — every row's Delete button
  uses `data-hc-confirm` + `data-hx-trigger="hc:confirmed"`. The
  confirm-action behavior shows a modal and re-emits a `hc:confirmed`
  event so htmx fires `DELETE /items/:id`.
- **Add form with request-action** — `<form data-hx-post="/items"
  data-hx-target="#items-tbody" data-hx-swap="beforeend">`. The
  submit button is wrapped in `.hc-action` with a spinner indicator
  driven by `data-hx-disabled-elt` and `data-hx-indicator`.
- **Toast from HX-Trigger** — `POST /items` and
  `DELETE /items/:id` return:
  ```text
  HX-Trigger: {"hc:toast":{"message":"…","variant":"success"}}
  ```
  htmx dispatches `hc:toast` on `document.body`; the toast behavior
  renders the toast.

## API summary

| Method   | Path           | Response                                                          |
| -------- | -------------- | ----------------------------------------------------------------- |
| `GET`    | `/items`       | Current `<tr>` rows for the table body.                           |
| `POST`   | `/items`       | New `<tr>` + `HX-Trigger` toast (success) / 422 fragment (invalid). |
| `DELETE` | `/items/:id`   | Empty body + `HX-Trigger` toast (success) / 404.                  |
| `GET`    | `/search?q=…`  | Filtered `<tr>` rows.                                             |

State is in-memory; restarting the server resets the items.

## Files

```text
examples/htmx/
  index.html       Single-page demo
  server.mjs       Static + API server (~150 lines, zero deps)
  package.json     Build-and-start scripts
```
