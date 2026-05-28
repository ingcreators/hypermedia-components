// Auto-init entry for @hypermedia-components/core/behaviors.
//
// Importing this module registers all default behaviors against the
// document. Consumers who want explicit control can import the named
// installers from the main entry instead:
//
//   import { installConfirm } from '@hypermedia-components/core';
//   installConfirm();

import { installConfirm } from './confirm.js';
import { installToast } from './toast.js';
import { installCloseDialog } from './close-dialog.js';
import { installClosePopover } from './close-popover.js';
import { installRemoteDialog } from './remote-dialog.js';
import { installTabs } from './tabs.js';
import { installMenu } from './menu.js';
import { installTooltip } from './tooltip.js';

function init() {
  installConfirm();
  installToast();
  installCloseDialog();
  installClosePopover();
  installRemoteDialog();
  installTabs();
  installMenu();
  installTooltip();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}

export {
  installConfirm,
  installToast,
  installCloseDialog,
  installClosePopover,
  installRemoteDialog,
  installTabs,
  installMenu,
  installTooltip,
};
