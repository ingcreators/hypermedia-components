/**
 * rehype plugin — dogfood `hc-table` for Markdown tables in the docs.
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
 * Only hast `element` table nodes are touched — these are the
 * Markdown-generated tables. Authored JSX `<table>` in MDX is an
 * `mdxJsxFlowElement` node and is left untouched, so the live component
 * demos (which already use `hc-table`) are unaffected.
 */

function classList(properties) {
  const cn = properties && properties.className;
  if (Array.isArray(cn)) return [...cn];
  if (typeof cn === 'string') return cn.split(/\s+/).filter(Boolean);
  return [];
}

export default function rehypeHcTables() {
  return (tree) => {
    const walk = (node) => {
      if (!node || !Array.isArray(node.children)) return;
      for (let i = 0; i < node.children.length; i += 1) {
        const child = node.children[i];
        if (child.type === 'element' && child.tagName === 'table') {
          const classes = classList(child.properties);
          if (!classes.includes('hc-table')) {
            classes.push('hc-table');
            child.properties = { ...(child.properties || {}), className: classes };
            node.children[i] = {
              type: 'element',
              tagName: 'div',
              properties: { className: ['hc-table-scroll', 'not-content'] },
              children: [child],
            };
          }
          // Tables don't nest in our docs — no need to descend.
          continue;
        }
        walk(child);
      }
    };
    walk(tree);
  };
}
