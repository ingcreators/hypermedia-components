import './dom-setup.mjs';
import { describe, it, expect, afterEach } from 'vitest';
import { t, setMessages, resetMessages, getMessages, DEFAULT_MESSAGES } from '../src/js/i18n.js';
import { installCombobox } from '../src/js/combobox.js';

// jsdom shims for popover (combobox integration case).
if (!HTMLElement.prototype.showPopover) {
  HTMLElement.prototype.showPopover = function () {};
  HTMLElement.prototype.hidePopover = function () {};
}
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = { supports: () => false, escape: (s) => String(s) };
}

afterEach(() => {
  resetMessages();
  document.body.innerHTML = '';
});

describe('i18n catalog', () => {
  it('t() returns the built-in English default', () => {
    expect(t('combobox.empty')).toBe('No matches');
    expect(t('confirm.cancel')).toBe('Cancel');
  });

  it('t() falls back to the key itself for unknown keys', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('setMessages() overrides a single key and leaves others intact', () => {
    setMessages({ 'combobox.empty': '一致なし' });
    expect(t('combobox.empty')).toBe('一致なし');
    expect(t('confirm.cancel')).toBe('Cancel');
  });

  it('setMessages() returns a restore function', () => {
    const restore = setMessages({ 'confirm.title': '確認' });
    expect(t('confirm.title')).toBe('確認');
    restore();
    expect(t('confirm.title')).toBe('Confirm');
  });

  it('resetMessages() reverts everything to defaults', () => {
    setMessages({ 'toast.label': '通知', 'splitter.resize': 'パネルをリサイズ' });
    resetMessages();
    expect(t('toast.label')).toBe('Notifications');
    expect(t('splitter.resize')).toBe('Resize panels');
  });

  it('interpolates {name} placeholders from params', () => {
    setMessages({ 'multicombobox.remove': '{label} を削除' });
    expect(t('multicombobox.remove', { label: 'Japan' })).toBe('Japan を削除');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(t('multicombobox.remove', { other: 'x' })).toBe('Remove {label}');
  });

  it('getMessages() is a snapshot that does not mutate the catalog', () => {
    const snap = getMessages();
    snap['combobox.empty'] = 'mutated';
    expect(t('combobox.empty')).toBe('No matches');
  });

  it('DEFAULT_MESSAGES is frozen', () => {
    expect(Object.isFrozen(DEFAULT_MESSAGES)).toBe(true);
  });
});

describe('i18n flows into behaviors', () => {
  const MARKUP = `
    <div class="hc-combobox">
      <input id="cb" type="text" role="combobox" aria-controls="lb" aria-label="Country">
      <ul id="lb" class="hc-combobox__listbox" role="listbox">
        <li class="hc-combobox__option" role="option" data-value="jp">Japan</li>
      </ul>
    </div>`;

  function filterToEmpty() {
    const input = document.getElementById('cb');
    input.dispatchEvent(new Event('focus'));
    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
  }

  it('combobox empty marker uses the catalog string', () => {
    setMessages({ 'combobox.empty': '一致なし' });
    document.body.innerHTML = MARKUP;
    const uninstall = installCombobox();
    filterToEmpty();
    expect(document.querySelector('.hc-combobox__empty').textContent).toBe('一致なし');
    uninstall();
  });

  it('a per-element data-hc-empty attribute wins over the catalog', () => {
    setMessages({ 'combobox.empty': '一致なし' });
    document.body.innerHTML = MARKUP;
    document.getElementById('lb').setAttribute('data-hc-empty', 'No countries');
    const uninstall = installCombobox();
    filterToEmpty();
    expect(document.querySelector('.hc-combobox__empty').textContent).toBe('No countries');
    uninstall();
  });
});
