// @hypermedia-components/core behaviors entry point.
//
// Behaviors are small, framework-agnostic helpers that observe Light DOM
// events (clicks, htmx:afterRequest, ...) and never wrap fetch().
//
// Planned behaviors:
//   - confirm   (data-hc-confirm)
//   - toast     (hc:toast event)
//   - closeDialog   (data-hc-close-dialog-on-success)
//   - closePopover  (data-hc-close-popover-on-success)
//
// This file is a scaffold; individual behaviors will be added in future PRs.

export const version = '0.0.0';
