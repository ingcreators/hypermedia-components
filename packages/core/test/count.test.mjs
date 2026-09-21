import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installCount } from '../src/js/count.js';
import { setMessages, resetMessages } from '../src/js/i18n.js';

let uninstall = () => {};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  resetMessages();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

function type(control, value) {
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function placeMemo({ controlAttrs = 'maxlength="20"', output = '<p class="hc-field__hint" id="memo-count">server text</p>', countAttr = 'data-hc-count="memo-count"' } = {}) {
  document.body.innerHTML = `
    <div class="hc-field">
      <label class="hc-field__label" for="memo">Memo</label>
      <textarea class="hc-input" id="memo" name="memo" ${controlAttrs} ${countAttr}></textarea>
      ${output}
    </div>
  `;
  return {
    control: document.getElementById('memo'),
    output: document.querySelector('.hc-field__hint'),
  };
}

describe('installCount', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    placeMemo();
    const u1 = installCount();
    const u2 = installCount();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('renders {used} / {max} from maxlength at install and on input', () => {
    const { control, output } = placeMemo();
    uninstall = installCount();
    expect(output.textContent).toBe('0 / 20');
    type(control, 'hello');
    expect(output.textContent).toBe('5 / 20');
  });

  it('counts UTF-16 code units, as maxlength does', () => {
    const { control, output } = placeMemo();
    uninstall = installCount();
    type(control, 'あいう😀'); // 3 + a surrogate pair
    expect(output.textContent).toBe('5 / 20');
  });

  it('marks the last 10% as near, and clears it again', () => {
    const { control, output } = placeMemo();
    uninstall = installCount();
    type(control, 'x'.repeat(17));
    expect(output.hasAttribute('data-count-state')).toBe(false);
    type(control, 'x'.repeat(18)); // 2 remaining = ceil(20 * 0.1)
    expect(output.getAttribute('data-count-state')).toBe('near');
    type(control, 'x'.repeat(3));
    expect(output.hasAttribute('data-count-state')).toBe(false);
  });

  it('a soft limit (data-hc-count-max) allows overflow and marks it over', () => {
    const { control, output } = placeMemo({ controlAttrs: 'data-hc-count-max="10"' });
    uninstall = installCount();
    type(control, 'x'.repeat(12));
    expect(output.textContent).toBe('12 / 10');
    expect(output.getAttribute('data-count-state')).toBe('over');
  });

  it('a soft limit wins over maxlength for the displayed max', () => {
    const { output } = placeMemo({ controlAttrs: 'maxlength="100" data-hc-count-max="10"' });
    uninstall = installCount();
    expect(output.textContent).toBe('0 / 10');
  });

  it('with no limit at all it shows the used count only', () => {
    const { control, output } = placeMemo({ controlAttrs: '' });
    uninstall = installCount();
    type(control, 'abc');
    expect(output.textContent).toBe('3');
    expect(output.hasAttribute('data-count-state')).toBe(false);
  });

  it('bare data-hc-count finds the <output for="<control id>">', () => {
    const { control, output } = placeMemo({
      countAttr: 'data-hc-count',
      output: '<output class="hc-field__hint" for="memo">server text</output>',
    });
    uninstall = installCount();
    expect(output.tagName).toBe('OUTPUT');
    expect(output.textContent).toBe('0 / 20');
    type(control, 'ab');
    // An <output> is live: the update waits for a typing pause.
    expect(output.textContent).toBe('0 / 20');
  });

  it('a live output updates 500 ms after the last keystroke', () => {
    vi.useFakeTimers();
    const { control, output } = placeMemo({
      output: '<p class="hc-field__hint" id="memo-count" aria-live="polite">server text</p>',
    });
    uninstall = installCount();
    type(control, 'a');
    type(control, 'ab');
    vi.advanceTimersByTime(400);
    expect(output.textContent).toBe('0 / 20');
    type(control, 'abc');
    vi.advanceTimersByTime(400);
    expect(output.textContent).toBe('0 / 20'); // timer restarted
    vi.advanceTimersByTime(100);
    expect(output.textContent).toBe('3 / 20');
  });

  it('a plain element updates immediately', () => {
    const { control, output } = placeMemo();
    uninstall = installCount();
    type(control, 'abcd');
    expect(output.textContent).toBe('4 / 20');
  });

  it('uses the i18n catalog for the text', () => {
    setMessages({ 'count.of': '残り {remaining} 文字' });
    const { control, output } = placeMemo();
    uninstall = installCount();
    type(control, 'abc');
    expect(output.textContent).toBe('残り 17 文字');
  });

  it('attaches to controls swapped in after install', async () => {
    uninstall = installCount();
    const { control, output } = placeMemo();
    await tick();
    expect(output.textContent).toBe('0 / 20');
    type(control, 'ab');
    expect(output.textContent).toBe('2 / 20');
  });

  it('does nothing when the output cannot be found', () => {
    document.body.innerHTML = '<textarea data-hc-count="nope" maxlength="5"></textarea>';
    uninstall = installCount();
    expect(() => type(document.querySelector('textarea'), 'x')).not.toThrow();
  });

  it('the uninstaller detaches', () => {
    const { control, output } = placeMemo();
    const u = installCount();
    u();
    type(control, 'abc');
    expect(output.textContent).toBe('0 / 20');
  });
});
