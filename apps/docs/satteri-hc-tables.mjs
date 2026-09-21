/**
 * Sätteri hast plugin — dogfood `hc-table` for Markdown tables in the docs.
 *
 * Every Markdown (`| … |`) table is wrapped in
 *   <div class="hc-table-scroll not-content"><table class="hc-table">…
 * so the docs reference tables render as HC's own component instead of
 * Starlight's built-in table styling.
 *
 * Two cascade facts make the wrapper necessary (not just the class):
 *   - Starlight styles tables with UNLAYERED rules; `hc-table` lives in
 *     `@layer hc.components`, and layered styles lose to unlayered ones.
 *   - But every Starlight table rule is gated behind
 *     `:not(:where(.not-content *))`, so putting the table inside a
 *     `.not-content` ancestor makes Starlight back off — and then the
 *     `hc-table` layer applies. The same `.hc-table-scroll` wrapper also
 *     gives wide tables a horizontal scroll strip.
 *
 * The `element` visitor with a `table` filter only sees hast `element`
 * nodes — the Markdown-generated tables. Authored JSX `<table>` in MDX is
 * an `mdxJsxFlowElement` node (a different visitor key) and raw HTML in
 * `.md` is a `raw` node, so both are left untouched and the live component
 * demos (which already use `hc-table`) are unaffected.
 *
 * Plugged in via `markdown.processor: satteri({ hastPlugins: [...] })`;
 * `@astrojs/mdx` inherits the processor, so `.md` and `.mdx` pages get the
 * same treatment.
 */

function classList(properties) {
  const cn = properties && properties.className;
  if (Array.isArray(cn)) return [...cn];
  if (typeof cn === 'string') return cn.split(/\s+/).filter(Boolean);
  return [];
}

export default function satteriHcTables() {
  return {
    name: 'hc-tables',
    element: {
      filter: ['table'],
      visit(node, ctx) {
        const classes = classList(node.properties);
        if (classes.includes('hc-table')) return;
        ctx.setProperty(node, 'className', [...classes, 'hc-table']);
        ctx.wrapNode(node, {
          type: 'element',
          tagName: 'div',
          properties: { className: ['hc-table-scroll', 'not-content'] },
          children: [],
        });
      },
    },
  };
}
