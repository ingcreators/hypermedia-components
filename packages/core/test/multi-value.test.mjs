import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installMultiValue, splitValues } from '../src/js/multi-value.js';

let uninstall = () => {};

const FIXTURE = `
  <form id="filters">
    <textarea name="f-buyer" id="buyer" data-hc-multi="lines">ZAB001000000
test1
test2</textarea>
    <input name="f-status" id="status" value="open">
  </form>
`;

// jsdom implements FormData but not the `formdata` event, so build the
// entry list by hand and dispatch the event the way a browser would
// while constructing `new FormData(form)` — the same helper shape the
// format tests use. Real-browser firing is pinned by
// test-browser/multi-value.spec.mjs across all three engines.
function serialize(form) {
  const formData = new FormData();
  for (const el of form.elements) {
    if (el.name && !el.disabled && el.value !== undefined && el.type !== 'submit') {
      formData.append(el.name, el.value);
    }
  }
  const event = new Event('formdata', { bubbles: true });
  event.formData = formData;
  form.dispatchEvent(event);
  return [...formData.entries()];
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
});

describe('splitValues', () => {
  it('trims, drops blanks, and de-duplicates', () => {
    expect(splitValues('  a \n\n b \na\n')).toEqual(['a', 'b']);
  });

  it('only splits on commas when asked', () => {
    expect(splitValues('a,b')).toEqual(['a,b']);
    expect(splitValues('a,b', 'commas')).toEqual(['a', 'b']);
  });

  it('an empty control contributes nothing', () => {
    expect(splitValues('   \n  \n')).toEqual([]);
  });
});

describe('installMultiValue', () => {
  it('sends one entry per line, under the same name', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installMultiValue();
    const entries = serialize(document.getElementById('filters'));
    expect(entries).toEqual([
      ['f-buyer', 'ZAB001000000'],
      ['f-buyer', 'test1'],
      ['f-buyer', 'test2'],
      ['f-status', 'open'],
    ]);
  });

  it('leaves ordinary controls alone', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installMultiValue();
    const entries = serialize(document.getElementById('filters'));
    expect(entries.filter(([name]) => name === 'f-status')).toEqual([
      ['f-status', 'open'],
    ]);
  });

  it('an emptied condition disappears rather than arriving blank', () => {
    document.body.innerHTML = FIXTURE;
    uninstall = installMultiValue();
    document.getElementById('buyer').value = '\n  \n';
    const names = serialize(document.getElementById('filters')).map(([n]) => n);
    expect(names).toEqual(['f-status']);
  });

  it('does not touch a name it shares with another control', () => {
    // A hidden input carrying another region's value would be clobbered
    // by a blind delete().
    document.body.innerHTML = `
      <form id="filters">
        <input type="hidden" name="f-buyer" value="from-elsewhere">
        <textarea name="f-buyer" id="buyer" data-hc-multi="lines">a
b</textarea>
      </form>`;
    uninstall = installMultiValue();
    const entries = serialize(document.getElementById('filters'));
    expect(entries).toEqual([
      ['f-buyer', 'from-elsewhere'],
      ['f-buyer', 'a\nb'],
    ]);
  });

  it('skips disabled and unnamed controls', () => {
    document.body.innerHTML = `
      <form id="filters">
        <textarea name="f-a" data-hc-multi="lines" disabled>x
y</textarea>
        <textarea data-hc-multi="lines">x
y</textarea>
      </form>`;
    uninstall = installMultiValue();
    expect(serialize(document.getElementById('filters'))).toEqual([]);
  });

  it('is idempotent and uninstalls cleanly', () => {
    document.body.innerHTML = FIXTURE;
    const first = installMultiValue();
    const second = installMultiValue();
    expect(second).toBe(first);
    // Installing twice must not double the entries.
    expect(
      serialize(document.getElementById('filters')).filter(
        ([name]) => name === 'f-buyer',
      ),
    ).toHaveLength(3);

    first();
    uninstall = () => {};
    const raw = serialize(document.getElementById('filters'));
    expect(raw).toEqual([
      ['f-buyer', 'ZAB001000000\ntest1\ntest2'],
      ['f-status', 'open'],
    ]);
  });
});
