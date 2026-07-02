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
import { installDatagridActions } from './datagrid-actions.js';
import { installValidation } from './validation.js';
import { installThemeToggle } from './theme-toggle.js';
import { installFieldErrors } from './field-errors.js';
import { installCsrfHeader } from './csrf-header.js';
import { installCopy } from './copy.js';
import { installSpy } from './spy.js';
import { installNavCurrent } from './nav-current.js';
import { installSparkline } from './sparkline.js';
import { installCodeEditor } from './code-editor.js';

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
  installDatagridActions();
  installValidation();
  installThemeToggle();
  installFieldErrors();
  installCsrfHeader();
  installCopy();
  installSpy();
  installNavCurrent();
  installSparkline();
  installCodeEditor();
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
  installDatagridActions,
  installValidation,
  installThemeToggle,
  installFieldErrors,
  installCsrfHeader,
  installCopy,
  installSpy,
  installNavCurrent,
  installSparkline,
  installCodeEditor,
};

// registerCodeLanguage — plug a tokenizer into the editable-code highlight
// overlay. Register before the field is enhanced (e.g. inline before this
// module loads, or call installCodeEditor() again afterwards).
export { registerCodeLanguage } from './code-syntax.js';

// i18n — set the locale before this module's auto-init runs (e.g. inline
// before the script that imports it), or import the named installers from
// the main entry for full control over ordering.
export { setMessages, resetMessages, getMessages, hasMessage, DEFAULT_MESSAGES } from './i18n.js';
