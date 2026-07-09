// render-ext markdown renderer — pure(ish): takes text, returns a DOM node.
// Pipeline: front matter -> ::: callouts -> marked -> DOMPurify -> DOM,
// then per-block mermaid / wavedrom / highlight.js. No document.body writes.
'use strict';

// fence names people actually write -> hljs grammar names
const RX_FENCE_ALIAS = {
  systemverilog: 'verilog',
  veriloghdl: 'verilog',
  'c++': 'cpp',
  'c#': 'csharp',
  json5: 'json',
  jsonl: 'json',
  yml: 'yaml',
  shell: 'bash',
  console: 'bash',
  text: 'plaintext'
};

async function rxRenderMarkdown(raw, spec) {
  spec = spec || {};
  let text = raw;

  // 1. YAML front matter -> collapsed <details>
  let frontMatter = null;
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (fm) {
    frontMatter = fm[1];
    text = text.slice(fm[0].length);
  }

  // 2. ::: callouts (uvm-drill style)
  text = text.replace(
    /^:::[ \t]*([A-Za-z][\w-]*)[^\n]*\r?\n([\s\S]*?)\r?\n:::[ \t]*$/gm,
    (_, name, body) =>
      `<div class="rx-callout rx-callout-${name.toLowerCase()}">` +
      `<p class="rx-callout-title">${name.toUpperCase()}</p>\n\n${body}\n\n</div>`
  );

  // 3. markdown -> sanitized HTML
  marked.setOptions({ gfm: true, breaks: false });
  const clean = DOMPurify.sanitize(marked.parse(text));

  const root = document.createElement('article');
  root.className = 'markdown-body rx-md-root';
  root.innerHTML = clean;

  if (frontMatter) {
    const det = document.createElement('details');
    det.className = 'rx-frontmatter';
    const sum = document.createElement('summary');
    sum.textContent = 'Front matter';
    const pre = document.createElement('pre');
    pre.textContent = frontMatter;
    det.append(sum, pre);
    root.prepend(det);
  }

  // 4. heading anchors
  const seen = new Map();
  for (const h of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    if (h.id) continue;
    let id = h.textContent.trim().toLowerCase()
      .replace(/[^\w가-힣\- ]+/g, '').replace(/\s+/g, '-');
    const n = seen.get(id) || 0;
    seen.set(id, n + 1);
    h.id = n ? `${id}-${n}` : id;
  }
  const h1 = root.querySelector('h1');
  const title = (h1 ? h1.textContent.trim() : '') || spec.file || '';

  // 5. code blocks: replace mermaid/wavedrom with placeholders (rendered later,
  //    once attached — see rxRenderDiagrams); highlight everything else now.
  //    hljs works off-DOM; mermaid/wavedrom need the node in the live document.
  for (const code of [...root.querySelectorAll('pre > code')]) {
    let lang = ([...code.classList].find((c) => c.startsWith('language-')) || '')
      .slice('language-'.length);
    lang = RX_FENCE_ALIAS[lang] || lang;
    const pre = code.parentElement;
    const source = code.textContent;

    if (lang === 'mermaid') {
      const holder = document.createElement('div');
      holder.className = 'mermaid rx-diagram rx-mermaid-pending';
      holder.textContent = source;
      pre.replaceWith(holder);
    } else if (lang === 'wavedrom') {
      const holder = document.createElement('div');
      holder.className = 'rx-diagram rx-wavedrom rx-wavedrom-pending';
      holder.dataset.rxSource = source;
      pre.replaceWith(holder);
    } else if (lang && hljs.getLanguage(lang)) {
      code.className = 'language-' + lang;
      hljs.highlightElement(code);
    } else if (lang) {
      pre.dataset.rxLang = lang;
      pre.classList.add('rx-unknown-fence');
    }
  }

  const headings = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => h.id);
  return { node: root, headings, title };
}

// Render mermaid/wavedrom placeholders. MUST run after `node` is attached to the
// document — both libraries measure layout (getBBox / getAttribute) and throw on
// detached nodes. A failed diagram is isolated; the rest still render.
async function rxRenderDiagrams(node) {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  try {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' });
  } catch (e) {}

  for (const holder of [...node.querySelectorAll('.rx-mermaid-pending')]) {
    holder.classList.remove('rx-mermaid-pending');
    const source = holder.textContent;
    try {
      await mermaid.run({ nodes: [holder], suppressErrors: false });
    } catch (e) {
      holder.replaceWith(rxDiagramError('mermaid', source, e));
    }
  }

  let i = window.__rxWdCount || 0;
  for (const holder of [...node.querySelectorAll('.rx-wavedrom-pending')]) {
    holder.classList.remove('rx-wavedrom-pending');
    const source = holder.dataset.rxSource || '';
    const inner = document.createElement('div');
    inner.id = 'rx-wd-' + i;
    holder.appendChild(inner);
    try {
      WaveDrom.RenderWaveForm(i, JSON5.parse(source), 'rx-wd-');
    } catch (e) {
      holder.replaceWith(rxDiagramError('wavedrom', source, e));
    }
    i++;
  }
  window.__rxWdCount = i;
}

function rxDiagramError(kind, source, err) {
  const box = document.createElement('div');
  box.className = 'rx-diagram-error';
  const msg = document.createElement('p');
  const detail = (err && (err.str || err.message)) || String(err);
  msg.textContent = `${kind} render failed: ${detail}`;
  const pre = document.createElement('pre');
  pre.textContent = source;
  box.append(msg, pre);
  return box;
}
