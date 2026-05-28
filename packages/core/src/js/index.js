// @hypermedia-components/core — main JS entry.
//
// Named exports only; no side effects. Use this entry when you want
// explicit control over which behaviors are installed. For zero-config
// auto-init, import "@hypermedia-components/core/behaviors" instead.

export { installConfirm } from './confirm.js';
export { installToast } from './toast.js';
export { installCloseDialog } from './close-dialog.js';
export { installClosePopover } from './close-popover.js';
export { installRemoteDialog } from './remote-dialog.js';
export { installTabs } from './tabs.js';

export const version = '0.0.0';
