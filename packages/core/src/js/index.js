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
export { installMenu } from './menu.js';
export { installMenubar } from './menubar.js';
export { installNavmenu } from './navmenu.js';
export { installTooltip } from './tooltip.js';
export { installPopover } from './popover.js';
export { installSlider } from './slider.js';
export { installRange } from './range.js';
export { installCombobox } from './combobox.js';
export { installMulticombobox } from './multicombobox.js';
export { installDrawer } from './drawer.js';
export { installHovercard } from './hovercard.js';
export { installToggleGroup } from './toggle-group.js';
export { installCarousel } from './carousel.js';
export { installToolbar } from './toolbar.js';
export { installAvatar } from './avatar.js';
export { installPasswordToggle } from './password-toggle.js';
export { installContextMenu } from './context-menu.js';
export { installCommand } from './command.js';
export { installCalendar } from './calendar.js';
export { installInputOtp } from './inputotp.js';
export { installSplitter } from './splitter.js';
export { installShell } from './shell.js';
export { installDatagrid } from './datagrid.js';
export { installDatagridActions } from './datagrid-actions.js';
export { installValidation } from './validation.js';
export { installThemeToggle } from './theme-toggle.js';
export { installFieldErrors } from './field-errors.js';
export { installCsrfHeader } from './csrf-header.js';
export { installSseDispatch } from './sse-dispatch.js';
export { installUploadProgress } from './upload-progress.js';
export { installDropzone } from './dropzone.js';
export { installChatScroll } from './chat-scroll.js';
export { installTree } from './tree.js';
export { installCopy } from './copy.js';
export { installSpy } from './spy.js';
export { installNavCurrent } from './nav-current.js';
export { installSparkline } from './sparkline.js';
export { installCodeEditor } from './code-editor.js';
export { installShowWhen } from './show-when.js';
export { installSortable } from './sortable.js';
export { installFormat, installNormalize } from './format.js';

// registerCodeLanguage — plug a tokenizer into installCodeEditor()'s live
// highlight overlay (built-in grammars: sql, json, yaml, html).
export { registerCodeLanguage } from './code-syntax.js';

// installChart is opt-in (not part of the auto-init `behaviors` entry): it
// needs Observable Plot, an optional peer dependency you load yourself.
export { installChart } from './chart.js';

// i18n — translate the strings behaviors inject (created nodes, default
// ARIA labels). Call setMessages() once at startup, before installing.
export { setMessages, resetMessages, getMessages, hasMessage, DEFAULT_MESSAGES } from './i18n.js';

export const version = '0.2.0';
