# filter-popover — server response contract

Purpose: a popover that holds a filter form. Submitting the form sends an htmx request and closes the popover.

## Required client markup

- A trigger `<button popovertarget="...">`.
- A `<div class="hc-popover" popover>` with a form inside.
- The form has `data-hx-get` (or `post`), `data-hx-target`, and `data-hc-close-popover-on-success`.

## Server response

- Return HTML for the `data-hx-target` element.
- Status `2xx` triggers `hc.behaviors.js` to call `hidePopover()` on the closest `[popover]`.

## Accessibility

The popover is not implicitly a menu. If you need menu keyboard behavior, build it explicitly with roles and handlers — do not assume the popover provides it.
