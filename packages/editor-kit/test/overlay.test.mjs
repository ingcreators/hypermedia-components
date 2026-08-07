import { beforeEach, describe, expect, it } from 'vitest';
import { Overlay } from '../src/overlay.js';

// jsdom reports zero rects everywhere, so the mount sits at (0,0) and
// node geometry is injected via `rectOf` — mount-local == viewport.

let mount, canvas, rects;

function rect(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

const rectOf = (el) => rects.get(el) ?? rect(0, 0, 0, 0);

beforeEach(() => {
  document.body.innerHTML = '<div id="mount"></div><div id="canvas"></div>';
  mount = document.getElementById('mount');
  canvas = document.getElementById('canvas');
  rects = new Map();
});

describe('selection boxes', () => {
  it('draws one positioned box per selected node', () => {
    canvas.innerHTML = '<p id="a">a</p><p id="b">b</p>';
    rects.set(document.getElementById('a'), rect(10, 20, 100, 30));
    rects.set(document.getElementById('b'), rect(10, 60, 100, 30));

    const overlay = new Overlay({ mount, rectOf });
    overlay.showSelection([...canvas.children]);

    const boxes = mount.querySelectorAll('.hc-editor-overlay__selection');
    expect(boxes.length).toBe(2);
    expect(boxes[0].style.left).toBe('10px');
    expect(boxes[0].style.top).toBe('20px');
    expect(boxes[0].style.width).toBe('100px');
    expect(boxes[0].style.height).toBe('30px');
    expect(boxes[0].style.pointerEvents).toBe('none');
    expect(boxes[1].style.top).toBe('60px');
  });

  it('replaces boxes on re-show and clears them', () => {
    canvas.innerHTML = '<p id="a">a</p>';
    const a = document.getElementById('a');
    rects.set(a, rect(0, 0, 10, 10));

    const overlay = new Overlay({ mount, rectOf });
    overlay.showSelection([a]);
    overlay.showSelection([a]);
    expect(mount.querySelectorAll('.hc-editor-overlay__selection').length).toBe(1);
    overlay.clearSelection();
    expect(mount.querySelectorAll('.hc-editor-overlay__selection').length).toBe(0);
  });
});

describe('drop indicator', () => {
  it('draws a horizontal line at a column boundary', () => {
    canvas.innerHTML = '<ul id="list"><li id="a">a</li><li id="b">b</li></ul>';
    const list = document.getElementById('list');
    rects.set(document.getElementById('a'), rect(0, 0, 100, 40));
    rects.set(document.getElementById('b'), rect(0, 40, 100, 40));

    const overlay = new Overlay({ mount, rectOf });
    const index = [...list.childNodes].indexOf(document.getElementById('b'));
    overlay.showDropIndicator({ container: list, index });

    const line = mount.querySelector('.hc-editor-overlay__indicator');
    expect(line.dataset.orientation).toBe('horizontal');
    expect(line.style.top).toBe('39px'); // boundary at y=40, 2px tall, centered
    expect(line.style.width).toBe('100px');
    expect(line.style.height).toBe('2px');
  });

  it('draws a vertical line when the neighbors share a row', () => {
    canvas.innerHTML = '<div id="bar"><button id="a">a</button><button id="b">b</button></div>';
    const bar = document.getElementById('bar');
    rects.set(document.getElementById('a'), rect(0, 0, 50, 30));
    rects.set(document.getElementById('b'), rect(60, 0, 50, 30));

    const overlay = new Overlay({ mount, rectOf });
    const index = [...bar.childNodes].indexOf(document.getElementById('b'));
    overlay.showDropIndicator({ container: bar, index });

    const line = mount.querySelector('.hc-editor-overlay__indicator');
    expect(line.dataset.orientation).toBe('vertical');
    expect(line.style.left).toBe('54px'); // midpoint of the 50–60 gap, 2px wide
    expect(line.style.height).toBe('30px');
  });

  it('outlines an empty container instead of drawing a line', () => {
    canvas.innerHTML = '<div id="empty"></div>';
    const empty = document.getElementById('empty');
    rects.set(empty, rect(5, 5, 200, 80));

    const overlay = new Overlay({ mount, rectOf });
    overlay.showDropIndicator({ container: empty, index: 0 });

    const line = mount.querySelector('.hc-editor-overlay__indicator');
    expect(line.dataset.empty).toBe('true');
    expect(line.style.width).toBe('200px');
    expect(line.style.height).toBe('80px');
  });

  it('accepts the onPreview feed shape, including null to hide', () => {
    canvas.innerHTML = '<div id="empty"></div>';
    const empty = document.getElementById('empty');
    rects.set(empty, rect(0, 0, 10, 10));

    const overlay = new Overlay({ mount, rectOf });
    overlay.showDropIndicator({ container: empty, index: 0 });
    expect(mount.querySelector('.hc-editor-overlay__indicator')).not.toBeNull();
    overlay.showDropIndicator(null);
    expect(mount.querySelector('.hc-editor-overlay__indicator')).toBeNull();
  });
});

describe('refresh and dispose', () => {
  it('refresh recomputes geometry and drops disconnected nodes', () => {
    canvas.innerHTML = '<p id="a">a</p><p id="b">b</p>';
    const a = document.getElementById('a');
    const b = document.getElementById('b');
    rects.set(a, rect(0, 0, 10, 10));
    rects.set(b, rect(0, 20, 10, 10));

    const overlay = new Overlay({ mount, rectOf });
    overlay.showSelection([a, b]);
    rects.set(b, rect(0, 50, 10, 10));
    a.remove();
    overlay.refresh();

    const boxes = mount.querySelectorAll('.hc-editor-overlay__selection');
    expect(boxes.length).toBe(1);
    expect(boxes[0].style.top).toBe('50px');
  });

  it('dispose removes everything from the mount', () => {
    canvas.innerHTML = '<p id="a">a</p>';
    const a = document.getElementById('a');
    rects.set(a, rect(0, 0, 10, 10));

    const overlay = new Overlay({ mount, rectOf });
    overlay.showSelection([a]);
    overlay.showDropIndicator({ container: canvas, index: 0 });
    overlay.dispose();
    expect(mount.children.length).toBe(0);
  });
});
