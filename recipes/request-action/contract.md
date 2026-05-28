# request-action — server response contract

Purpose: trigger a server request from a button and swap the response into a target.

## Required client markup

- `data-hx-{get|post|put|patch|delete}` — request method and URL.
- `data-hx-target` — element to swap.
- `data-hx-swap` — swap strategy (default `outerHTML`).
- `data-hx-disabled-elt="this"` — disable the button during the request.
- `data-hx-indicator="closest .hc-action"` — show the loading indicator.

## Server response

Return either:

- HTML fragment for the target area; or
- `HX-Trigger` header with events such as `hc:toast`; or
- both.

## Example

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
HX-Trigger: {"hc:toast":{"message":"Saved","variant":"success"}}

<tr id="item-123">...</tr>
```
