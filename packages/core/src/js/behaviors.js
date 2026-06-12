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
import { installMenubar } from './menubar.js';
import { installNavmenu } from './navmenu.js';
import { installTooltip } from './tooltip.js';
import { installPopover } from './popover.js';
import { installSlider } from './slider.js';
import { installCombobox } from './combobox.js';
import { installMulticombobox } from './multicombobox.js';
import { installDrawer } from './drawer.js';
import { installHovercard } from './hovercard.js';
import { installToggleGroup } from './toggle-group.js';
import { installCarousel } from './carousel.js';
import { installToolbar } from './toolbar.js';
import { installAvatar } from './avatar.js';
import { installPasswordToggle } from './password-toggle.js';
import { installContextMenu } from './context-menu.js';
import { installCommand } from './command.js';
import { installCalendar } from './calendar.js';
import { installInputOtp } from './inputotp.js';
import { installSplitter } from './splitter.js';
import { installShell } from './shell.js';
import { installDatagrid } from './datagrid.js';
import { installValidation } from './validation.js';
import { installThemeToggle } from './theme-toggle.js';
import { installFieldErrors } from './field-errors.js';

function init() {
  installConfirm();
  installToast();
  installCloseDialog();
  installClosePopover();
  installRemoteDialog();
  installTabs();
  installMenu();
  installMenubar();
  installNavmenu();
  installTooltip();
  installPopover();
  installSlider();
  installCombobox();
  installMulticombobox();
  installDrawer();
  installHovercard();
  installToggleGroup();
  installCarousel();
  installToolbar();
  installAvatar();
  installPasswordToggle();
  installContextMenu();
  installCommand();
  installCalendar();
  installInputOtp();
  installSplitter();
  installShell();
  installDatagrid();
  installValidation();
  installThemeToggle();
  installFieldErrors();
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
  installMenubar,
  installNavmenu,
  installTooltip,
  installPopover,
  installSlider,
  installCombobox,
  installMulticombobox,
  installDrawer,
  installHovercard,
  installToggleGroup,
  installCarousel,
  installToolbar,
  installAvatar,
  installPasswordToggle,
  installContextMenu,
  installCommand,
  installCalendar,
  installInputOtp,
  installSplitter,
  installShell,
  installDatagrid,
  installValidation,
  installThemeToggle,
  installFieldErrors,
};

// i18n — set the locale before this module's auto-init runs (e.g. inline
// before the script that imports it), or import the named installers from
// the main entry for full control over ordering.
export { setMessages, resetMessages, getMessages, hasMessage, DEFAULT_MESSAGES } from './i18n.js';
