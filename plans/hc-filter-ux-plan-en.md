# Filter UX — the state of a business list screen

Status: **approved** (2026-08-10). **Revised** the same day after a
requirements review: two of the additions below are not enhancements but
repairs — without them "saved views" does not work for the screens that
need it most. Eight work items; two have shipped.

## What the screen is for

A business user comes back to the same list many times a day. Their work
is a set of recurring **questions** ("orders shipping this week that are
not approved yet"), and each question carries a **working setup** — the
columns that matter for that job, the order, the density.

Everything below follows from that. The capabilities such a screen owes
its users:

| # | Capability | Cost of not having it |
| --- | --- | --- |
| 1 | Name a question and come back to it | Rebuilding the conditions every morning |
| 2 | Know what you are looking at right now | Deciding on the wrong data |
| 3 | Share exactly what you see | "It shows up on my screen" |
| 4 | Make it the team's standard | Each desk filters differently |
| 5 | Start where the work starts | The same setup, every day |
| 6 | Adjust without losing what you had | Rebuild instead of tweak |
| 7 | Ask about a list of identifiers | Alt-tabbing to a spreadsheet |
| 8 | Export what you are looking at | Downloading the 40 rows on screen |
| 9 | Come back to the same place after acting | Losing 200 hand-picked rows |
| 10 | Understand what a view meant | "What did this one filter on?" |

## The persistence model

Three kinds of state, three homes. Which one a thing belongs to decides
where it is stored, whether it is shared, and how it may fail.

| | **Query state** | **Workspace state** | **Transient state** |
| --- | --- | --- | --- |
| What | filters, sort, page, page size, search, grouping | visible columns, column order, widths, density, theme, sidebar | selection, scroll, focused cell, open popovers |
| Home | **the URL** | **a preference** — per user on the server for what should follow you between devices (columns, order); device-local for what describes this screen (theme, density, widths) | **nowhere** |
| Shared? | yes — that is the point | no; a link must not carry someone else's layout | no |
| May it fail silently? | **no** | yes | n/a |

Resolution order: **URL → user preference → app default.** A link has to
beat my stored preference, or sharing does not work; the URL carries
only what was set explicitly.

The asymmetry in the last row is the practical reason the split exists.
A column that no longer exists can quietly disappear — the user sees
less chrome. A **condition** that no longer resolves must never quietly
disappear, because the user then sees *more data than they asked for*.

Transient state is not persisted, but **Back must still return to the
same list without a refetch**. That is the browser's job (history +
bfcache) and it works for free — but only while the state that matters
lives in the URL. The application's obligation is not to break it.

## What already holds up

- **The querystring is the view.** `saved-views` stores the filter pairs
  under a name, applying is a plain `GET`, and the apply response fills
  the form's controls — a view is never an opaque blob.
- **Repeated `f-<col>` params** are already the filter contract.
- **`?sort=name,-price`** is already the sort format.

## Findings

The first eleven came from a UI review; the last six from asking what a
line-of-business screen actually needs. **R1 and R2 are repairs**, not
improvements.

| # | Finding | Status |
| --- | --- | --- |
| 1 | Applied conditions had no component (`hc-chip` is presentational, `hc-chips` wraps) | shipped (#525) |
| 2 | No way to edit one condition in place | item A |
| 3 | No multi-value entry control | item B |
| 4 | Sort was outside the filter form, so a view could not capture it | shipped (#526) |
| 5 | Two contradictory sort wire formats documented | shipped (#526) |
| 6 | Saved views have no **modified** state | item D |
| 7 | Saving is save-as only; no update in place | item D |
| 8 | No default view | item D |
| 9 | The views strip does not scale or order | item D |
| 10 | Applied conditions and saved views looked identical | shipped (#525) |
| 11 | "Views are per user by definition" — teams share them | item D |
| **R1** | **A saved view with a date range is wrong tomorrow** | **item C** |
| **R2** | **Bulk actions can only address a list of ids, never "everything that matches"** | **item E** |
| R3 | Export does not inherit the conditions | item F |
| R4 | Condition values are not required to be locale-independent | item C |
| R5 | Applying a view does not re-authorise | item D |
| R6 | Columns: no stated resolution order, and a view cannot pin them | item D |

### R1 — relative dates

A large share of the views a business actually saves are about time:
"shipping this week", "overdue", "received yesterday". Saving one today
freezes an **absolute** date (`f-ship-from=2026-08-10`); open it next
week and it is last week's question. This is not a missing convenience —
it means the saved-views feature does not work for the majority of its
real uses.

Condition values must therefore admit **relative expressions**
(`@today`, `@today-7d`, `@week-start`, `@month-end`), resolved by the
server, stored as the expression. The bar shows both: *"Ship date: this
week (from 2026-08-10)"* — the expression is what is saved, the resolved
value is what reassures.

Adding this later is more expensive than adding it now: every view saved
in the meantime has an absolute date that has to be migrated or
explained.

### R2 — bulk by query

When 4,873 rows match, the operation a user wants is "archive **all of
them**", not "archive these 200 I could tick". Enumerating ids does not
survive a querystring, a form, or a proxy.

The action must be expressible as **the query itself**: apply to
everything matching these conditions. The safety rails are the count
(shown and confirmed before running) and a token that pins the
conditions the count was taken from, so the set cannot drift between
"4,873 rows will be archived" and the execution. The pre-flight branch
of `datagrid-bulk-errors` already has the right shape for this.

## Work items

| Item | Content | Status |
| --- | --- | --- |
| — | `hc-filterbar` — the applied-conditions bar | **shipped** (#525) |
| — | Sort travels with the form, so a view captures it | **shipped** (#526) |
| A | `datagrid-filter` gains the applied-conditions contract: the server renders the bar, each chip opens the editor for its own condition, each remove link drops one param, empty results offer to relax the newest condition | |
| B | Multi-value conditions — `data-hc-multi="lines"` on a textarea splits lines into repeats on the `formdata` event; the condition-set `?…-set=<id>` escape hatch when a querystring stops fitting, which **must not fail open** | |
| C | **Relative date expressions** (R1) + the canonical-wire rule (R4): the wire is ISO and locale-independent, the display is localized, and the bar shows the expression *and* what it resolved to | |
| D | Saved views revised: modified state, update in place, default view via `303` (so the address bar always shows the real conditions), ordering and overflow, scope and shared-view labelling, column pinning and the resolution order (R6), re-authorisation on apply (R5) | |
| E | **Bulk by query** (R2): count, confirm, a token pinning the conditions, and the existing pre-flight/refusal branches | |
| F | Export inherits the conditions (R3) — the same querystring and `cols=`, all pages; large exports become a job rather than a download | |
| G | `templates/data-grid-page` adopts all of it | |

## Out of scope

- A nested AND/OR query builder. Business screens want a flat set of
  conditions; nesting is a different product.
- Client-side filtering. The server stays the schema and the filter.
- Resuming "where you left off" on load. A default view is explicit and
  visible; silently restoring the last session's filters hides data.
