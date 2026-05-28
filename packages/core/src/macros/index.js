// @hypermedia-components/core macros entry point.
//
// Macros are optional Light DOM custom elements that expand to plain
// HTML with hc-* classes and data-hx-* / data-hc-* attributes. They
// are never the only documented way to use a pattern — every macro
// page also shows the expanded HTML.
//
// Importing this module registers the macros against the global
// customElements registry. Registration is idempotent.

import { HcConfirmAction } from './confirm-action.js';
import { HcLiveSearch } from './live-search.js';

export { HcConfirmAction, HcLiveSearch };

export const version = '0.0.0';
