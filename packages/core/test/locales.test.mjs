import { describe, it, expect, afterEach } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { DEFAULT_MESSAGES, setMessages, resetMessages, t } from '../src/js/i18n.js';

// Locale pack completeness guard (#217). The key inventory of
// DEFAULT_MESSAGES is part of the public contract: every shipped pack must
// translate every key (a missing key silently falls back to English — the
// drift nobody notices) and carry no stale ones. Packs are discovered from
// src/js/locales/ so adding a pack is automatically covered.
const here = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(here, '..', 'src', 'js', 'locales');
const packFiles = readdirSync(localesDir).filter((f) => f.endsWith('.js'));

const placeholders = (str) => [...str.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => {
  resetMessages();
});

describe.each(packFiles)('locale pack %s', (file) => {
  it('covers every DEFAULT_MESSAGES key, with no stale keys', async () => {
    const pack = (await import(`../src/js/locales/${file}`)).default;
    const actual = new Set(Object.keys(DEFAULT_MESSAGES));
    const covered = new Set(Object.keys(pack));

    const missing = [...actual].filter((k) => !covered.has(k));
    const stale = [...covered].filter((k) => !actual.has(k));

    expect(missing, 'DEFAULT_MESSAGES keys the pack does not translate').toEqual([]);
    expect(stale, 'pack keys that no longer exist in DEFAULT_MESSAGES').toEqual([]);
  });

  it('preserves the {name} placeholders of each default', async () => {
    const pack = (await import(`../src/js/locales/${file}`)).default;
    for (const [key, def] of Object.entries(DEFAULT_MESSAGES)) {
      expect(placeholders(pack[key] ?? ''), `placeholders of ${key}`).toEqual(placeholders(def));
    }
  });

  it('is frozen and contains only non-empty strings', async () => {
    const pack = (await import(`../src/js/locales/${file}`)).default;
    expect(Object.isFrozen(pack)).toBe(true);
    for (const [key, value] of Object.entries(pack)) {
      expect(typeof value, key).toBe('string');
      expect(value.length, key).toBeGreaterThan(0);
    }
  });
});

describe('locale pack ja', () => {
  it('setMessages(ja) localizes every built-in string', async () => {
    const ja = (await import('../src/js/locales/ja.js')).default;
    setMessages(ja);
    for (const key of Object.keys(DEFAULT_MESSAGES)) {
      expect(t(key), key).toBe(ja[key]);
    }
  });
});
