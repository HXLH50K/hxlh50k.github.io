import headings from './legacy-headings.json' with { type: 'json' };

function textContent(node) {
  if (node.type === 'text') return node.value;
  return (node.children ?? []).map(textContent).join('');
}

function normalize(text) {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}

export default function legacyHeadings() {
  return (tree, file) => {
    const original = headings[file.data.astro?.frontmatter?.permalink];
    if (!original) return;
    const remaining = original.map((heading) => ({ ...heading, used: false }));
    function visit(node) {
      if (node.type === 'element' && /^h[1-6]$/.test(node.tagName)) {
        const text = normalize(textContent(node));
        const match = remaining.find((heading) => !heading.used && normalize(heading.text) === text);
        if (match) {
          node.properties.id = match.id;
          match.used = true;
        }
      }
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
  };
}
