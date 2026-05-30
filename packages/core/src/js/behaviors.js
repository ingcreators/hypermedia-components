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
import { installSlider } from './slider.js';
import { installCombobox } from './combobox.js';
import { installMulticombobox } from './multicombobox.js';
import { installDrawer } from './drawer.js';
import { installHovercard } from './hovercard.js';
import { installToggleGroup } from './toggle-group.js';
import { installContextMenu } from './context-menu.js';
import { installCommand } from './command.js';
import { installCalendar } from './calendar.js';
import { installInputOtp } from './inputotp.js';
import { installSplitter } from './splitter.js';
import { installShell } from './shell.js';

function init() {
  installConfirm();
  installToast();
  installCloseDialog();
  installClosePopover();
  installRemoteDialog();
  installTabs();
  installMenu();
  installTooltip();
  installSlider();
  installCombobox();
  installMulticombobox();
  installDrawer();
  installHovercard();
  installToggleGroup();
  installContextMenu();
  installCommand();
  installCalendar();
  installInputOtp();
  installSplitter();
  installShell();
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
  installSlider,
  installCombobox,
  installMulticombobox,
  installDrawer,
  installHovercard,
  installToggleGroup,
  installContextMenu,
  installCommand,
  installCalendar,
  installInputOtp,
  installSplitter,
  installShell,
};
