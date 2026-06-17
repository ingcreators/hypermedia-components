import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installSparkline } from '../src/js/sparkline.js';

let uninstall = () => {};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  document.body.innerHTML = '';
});

const svgOf = (host) => host.querySelector('svg.hc-sparkline__svg');
const pointCount = (el) => el.getAttribute('points').trim().split(/\s+/).length;

describe('installSparkline', () => {
  it('is idempotent — repeated calls return the same uninstaller', () => {
    document.body.innerHTML = '<span class="hc-sparkline" data-values="1,2,3"></span>';
    const u1 = installSparkline();
    const u2 = installSparkline();
    expect(u1).toBe(u2);
    uninstall = u1;
  });

  it('renders an aria-hidden svg with one polyline point per value', () => {
    document.body.innerHTML =
      '<span class="hc-sparkline" data-values="0.7,0.74,0.8,0.78,0.82"></span>';
    uninstall = installSparkline();

    const host = document.querySelector('.hc-sparkline');
    const svg = svgOf(host);
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none');

    const line = svg.querySelector('polyline.hc-sparkline__line');
    expect(line).not.toBeNull();
    expect(pointCount(line)).toBe(5);
  });

  it('labels the host role="img" when it has an accessible name', () => {
    document.body.innerHTML =
      '<span class="hc-sparkline" data-values="1,2,3" aria-label="Coverage trend"></span>';
    uninstall = installSparkline();
    expect(document.querySelector('.hc-sparkline').getAttribute('role')).toBe('img');
  });

  it('marks an unlabelled sparkline decorative (aria-hidden)', () => {
    document.body.innerHTML = '<span class="hc-sparkline" data-values="1,2,3"></span>';
    uninstall = installSparkline();
    const host = document.querySelector('.hc-sparkline');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.getAttribute('role')).toBeNull();
  });

  it('adds an area polygon only when data-area is present', () => {
    document.body.innerHTML =
      '<span id="a" class="hc-sparkline" data-values="1,2,3"></span>' +
      '<span id="b" class="hc-sparkline" data-values="1,2,3" data-area></span>';
    uninstall = installSparkline();
    expect(document.querySelector('#a polygon.hc-sparkline__area')).toBeNull();
    expect(document.querySelector('#b polygon.hc-sparkline__area')).not.toBeNull();
  });

  it('leaves a server-rendered svg (markup convention) untouched', () => {
    document.body.innerHTML =
      '<span class="hc-sparkline" data-values="1,2,3">' +
      '<svg class="hc-sparkline__svg" data-server="1"></svg></span>';
    uninstall = installSparkline();
    const svgs = document.querySelectorAll('.hc-sparkline .hc-sparkline__svg');
    expect(svgs).toHaveLength(1);
    expect(svgs[0].getAttribute('data-server')).toBe('1');
  });

  it('does not render (and hides) when values are missing or invalid', () => {
    document.body.innerHTML =
      '<span class="hc-sparkline" data-values="  ,foo, "></span>';
    uninstall = installSparkline();
    const host = document.querySelector('.hc-sparkline');
    expect(svgOf(host)).toBeNull();
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws a flat centre line for a single value', () => {
    document.body.innerHTML = '<span class="hc-sparkline" data-values="42"></span>';
    uninstall = installSparkline();
    const line = document.querySelector('polyline.hc-sparkline__line');
    expect(pointCount(line)).toBe(2); // 0,mid … 100,mid
  });

  it('renders sparklines delivered by an htmx:load swap', () => {
    uninstall = installSparkline();
    const region = document.createElement('div');
    region.innerHTML = '<span class="hc-sparkline" data-values="1,2,3,4"></span>';
    document.body.appendChild(region);
    region.dispatchEvent(new Event('htmx:load', { bubbles: true }));
    expect(svgOf(document.querySelector('.hc-sparkline'))).not.toBeNull();
  });
});
