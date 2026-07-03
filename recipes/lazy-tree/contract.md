# lazy-tree — server response contract

Purpose: a tree whose deep branches are not rendered up front. A lazy
branch ships an **empty group**; its children arrive as
server-rendered treeitems the first time the user expands it. The
recipe pairs `installTree()`'s `hc:treeexpand` event with an htmx
`once` trigger — the same event-trigger mechanism the datagrid lazy
detail uses. The behavior never touches the network; htmx owns the
request.

## Required client markup

A lazy branch is a normal `hc-tree` branch with four htmx attributes
on the `<li class="hc-tree__item">`:

```html
<li class="hc-tree__item" aria-expanded="false"
    data-hx-get="/nodes/42/children"
    data-hx-target="find .hc-tree__group"
    data-hx-swap="innerHTML"
    data-hx-trigger="hc:treeexpand once">
  <span class="hc-tree__row">
    <span class="hc-tree__toggle" aria-hidden="true"></span>
    <span class="hc-tree__label">Reports</span>
  </span>
  <ul class="hc-tree__group"></ul>
</li>
```

- `aria-expanded="false"` — branch-ness is **declared** by the
  attribute; the behavior only dispatches `hc:treeexpand` on branches.
- `data-hx-trigger="hc:treeexpand once"` — htmx fetches on the FIRST
  expand only. **`once` is the whole trick**: re-collapse/re-expand
  shows the already-loaded children with no further requests. Without
  it every expand refetches and re-swaps (blowing away any state in
  the loaded subtree).
- `data-hx-target="find .hc-tree__group"` — `find` resolves to the
  first match inside the item: its own group.
- `data-hx-swap="innerHTML"` — fill the group, keep the `<ul>` the
  behavior observes.
- The **empty** `<ul class="hc-tree__group"></ul>` must be present —
  it is the swap target, and the behavior marks it `aria-busy="true"`
  while the request is in flight (a spinner renders via CSS).

## Server response

Return **only the group's innerHTML** — a sequence of
`<li class="hc-tree__item">` fragments:

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<li class="hc-tree__item">
  <span class="hc-tree__row">
    <span class="hc-tree__label"><a href="/reports/summary">summary.pdf</a></span>
  </span>
</li>
```

Nested lazy branches **inside the response work recursively**: give
the fragment the same four attributes and an empty group. htmx
processes the new `data-hx-*` attributes on settle, and the behavior's
observer re-applies roles and the roving tabindex, so the swapped-in
items are immediately keyboard-navigable.

## Failure handling

htmx does not swap non-2xx responses, so on an error the branch simply
stays empty — but the `once` trigger is **spent**: re-expanding will
not retry. Be honest about this limitation:

- Surface the failure via an [`HX-Trigger`
  toast](../toast/contract.md) (remember to `\uXXXX`-escape non-ASCII
  in the header) so the user knows the load failed.
- Prefer server-side reliability over client retry choreography. If a
  subtree can genuinely fail often, render it eagerly instead.
- A future revision of `installTree()` may re-arm the trigger on
  error; today the recipe documents the constraint rather than hiding
  it.

The behavior clears `aria-busy` only when children actually arrive; if
the request fails, clear it server-side by returning an empty 200 body
plus the error toast — or accept the spinner as the "something went
wrong here" affordance until the page is refreshed.

## Progressive enhancement

Without JavaScript the markup is a plain nested list: every rendered
link keeps working, collapsed branches are simply hidden. Two no-JS
strategies:

- Render the tree **fully expanded** on the server (plain nested
  lists; lazy loading is an enhancement for the JS-enabled path).
- Or give every branch label a real link to a per-node page — the
  links ARE the fallback; deep trees become ordinary navigation.

## Accessibility

- The tree keeps the APG pattern throughout: swapped-in items get
  `role="treeitem"` and join the roving tabindex automatically.
- `aria-busy="true"` on the group announces the pending state; the
  spinner is CSS-only and disabled under reduced motion.
- Keyboard: → on a closed lazy branch opens it (triggering the fetch);
  once children arrive, → descends into them. Nothing about laziness
  changes the keyboard contract.
