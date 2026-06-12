# live-search — server response contract

Purpose: send a search request as the user types and swap the results.

## Required client markup

- `<form role="search">` with a `GET` action so it works without JavaScript.
- `data-hx-get` on the input — same URL as the form action.
- `data-hx-trigger="input changed delay:300ms, search"` — debounce typing, also respond to the `search` event.
- `data-hx-target="#results"` and `data-hx-swap="innerHTML"`.
- `data-hx-sync="closest form:replace"` — cancel in-flight requests when a newer one starts.

## Server response

- Return HTML for `#results`.
- Include empty-state markup when there are no results.
- Keep the normal form `GET` working without JavaScript.

Status: `200 OK` with the fragment. htmx ≥ 2 does not swap non-2xx
responses by default, so on a server error the previous results stay in
place — return `2xx` only when the fragment should replace them.
