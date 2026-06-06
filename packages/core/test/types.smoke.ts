// TypeScript smoke test for the published .d.ts surface.
//
// Run with `pnpm --filter @hypermedia-components/core typecheck`. The
// build step (`pnpm --filter @hypermedia-components/core build`) must
// have produced dist/*.d.ts files first; the package's "exports.types"
// entries point at those locations.
//
// This file is type-checked but never executed; the assertions exist
// purely so a future change that breaks the public type surface fails
// loudly in CI rather than silently shipping `any` to consumers.

import {
  installConfirm,
  installToast,
  installCloseDialog,
  installClosePopover,
  installRemoteDialog,
  installTabs,
  installMenu,
  installMenubar,
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
  installValidation,
  version,
} from '@hypermedia-components/core';

import {
  installConfirm as installConfirmFromBehaviors,
  installToast as installToastFromBehaviors,
  installCloseDialog as installCloseDialogFromBehaviors,
  installClosePopover as installClosePopoverFromBehaviors,
  installRemoteDialog as installRemoteDialogFromBehaviors,
  installTabs as installTabsFromBehaviors,
  installMenu as installMenuFromBehaviors,
  installMenubar as installMenubarFromBehaviors,
  installTooltip as installTooltipFromBehaviors,
  installPopover as installPopoverFromBehaviors,
  installSlider as installSliderFromBehaviors,
  installCombobox as installComboboxFromBehaviors,
  installMulticombobox as installMulticomboboxFromBehaviors,
  installDrawer as installDrawerFromBehaviors,
  installHovercard as installHovercardFromBehaviors,
  installToggleGroup as installToggleGroupFromBehaviors,
  installCarousel as installCarouselFromBehaviors,
  installToolbar as installToolbarFromBehaviors,
  installAvatar as installAvatarFromBehaviors,
  installPasswordToggle as installPasswordToggleFromBehaviors,
  installContextMenu as installContextMenuFromBehaviors,
  installCommand as installCommandFromBehaviors,
  installCalendar as installCalendarFromBehaviors,
  installInputOtp as installInputOtpFromBehaviors,
  installSplitter as installSplitterFromBehaviors,
  installValidation as installValidationFromBehaviors,
} from '@hypermedia-components/core/behaviors';

import { HcConfirmAction, HcLiveSearch } from '@hypermedia-components/core/macros';

// Each installer accepts an optional Document and returns a no-arg
// uninstaller. Calling with no argument and with a Document must both
// type-check.
const uninstallers: Array<() => void> = [
  installConfirm(),
  installToast(document),
  installCloseDialog(),
  installClosePopover(document),
  installRemoteDialog(),
  installTabs(document),
  installMenu(document),
  installMenubar(document),
  installTooltip(document),
  installPopover(document),
  installSlider(document),
  installCombobox(document),
  installMulticombobox(document),
  installDrawer(document),
  installHovercard(document),
  installToggleGroup(document),
  installCarousel(document),
  installToolbar(document),
  installAvatar(document),
  installPasswordToggle(document),
  installContextMenu(document),
  installCommand(document),
  installCalendar(document),
  installInputOtp(document),
  installSplitter(document),
  installValidation(document),
  installConfirmFromBehaviors(),
  installToastFromBehaviors(),
  installCloseDialogFromBehaviors(),
  installClosePopoverFromBehaviors(),
  installRemoteDialogFromBehaviors(),
  installTabsFromBehaviors(),
  installMenuFromBehaviors(),
  installMenubarFromBehaviors(),
  installTooltipFromBehaviors(),
  installPopoverFromBehaviors(),
  installSliderFromBehaviors(),
  installComboboxFromBehaviors(),
  installMulticomboboxFromBehaviors(),
  installDrawerFromBehaviors(),
  installHovercardFromBehaviors(),
  installToggleGroupFromBehaviors(),
  installCarouselFromBehaviors(),
  installToolbarFromBehaviors(),
  installAvatarFromBehaviors(),
  installPasswordToggleFromBehaviors(),
  installContextMenuFromBehaviors(),
  installCommandFromBehaviors(),
  installCalendarFromBehaviors(),
  installInputOtpFromBehaviors(),
  installSplitterFromBehaviors(),
  installValidationFromBehaviors(),
];

// `version` is a string literal export.
const v: string = version;

// Macro exports are concrete custom element classes that extend
// HTMLElement (the constructor is callable via customElements.define).
const macroClasses: Array<typeof HTMLElement> = [HcConfirmAction, HcLiveSearch];

// Touch the values so unused-variable lint rules stay quiet across
// strictness levels. None of this code is ever executed.
export const __smoke = { uninstallers, v, macroClasses };
