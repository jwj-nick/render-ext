// render-ext Markdown renderer.
// Pipeline: front matter -> ::: callouts -> marked -> DOMPurify -> DOM,
// then per-block: mermaid / wavedrom / highlight.js.
'use strict';

(async () => {
  if (window.__rxRendered) return;
  window.__rxRendered = true;

  const spec = window.__rxSpec || { label: 'Markdown', file: '' };
  const srcPre = document.body.firstElementChild;
  const raw = srcPre.textContent;

  // --- 1. YAML front matter -> collapsed <details> ---------------------
  let text = raw;
  let frontMatter = null;
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (fm) {
    frontMatter = fm[1];
    text = text.slice(fm[0].length);
  }

  // --- 2. ::: callouts (uvm-drill style: :::tldr / :::gotcha / ...) ----
  // ::: name\n body \n:::  ->  styled div; body is still parsed as markdown
  // (blank lines around it make marked treat the div as an HTML block).
  text = text.replace(
    /^:::[ \t]*([A-Za-z][\w-]*)[^\n]*\r?\n([\s\S]*?)\r?\n:::[ \t]*$/gm,
    (_, name, body) =>
      `<div class="rx-callout rx-callout-${name.toLowerCase()}">` +
      `<p class="rx-callout-title">${name.toUpperCase()}</p>\n\n${body}\n\n</div>`
  );

  // --- 3. markdown -> sanitized HTML ------------------------------------
  marked.setOptions({ gfm: true, breaks: false });
  const dirty = marked.parse(text);
  const clean = DOMPurify.sanitize(dirty);

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

  srcPre.style.display = 'none';
  document.body.appendChild(root);
  document.documentElement.classList.add('rx-page');

  // --- 4. heading anchors ----------------------------------------------
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
  document.title = (h1 ? h1.textContent.trim() : spec.file) || document.title;

  // --- 5. code blocks: mermaid / wavedrom / hljs ------------------------
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: dark ? 'dark' : 'default'
  });

  let wdIndex = 0;
  const mermaidJobs = [];

  // Fence names people actually write -> hljs grammar names.
  const FENCE_ALIAS = {
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

  for (const code of [...root.querySelectorAll('pre > code')]) {
    let lang = ([...code.classList].find((c) => c.startsWith('language-')) || '')
      .slice('language-'.length);
    lang = FENCE_ALIAS[lang] || lang;
    const pre = code.parentElement;
    const source = code.textContent;

    if (lang === 'mermaid') {
      const holder = document.createElement('div');
      holder.className = 'mermaid rx-diagram';
      holder.textContent = source;
      pre.replaceWith(holder);
      mermaidJobs.push({ holder, source });
    } else if (lang === 'wavedrom') {
      const holder = document.createElement('div');
      holder.className = 'rx-diagram rx-wavedrom';
      const inner = document.createElement('div');
      inner.id = 'rx-wd-' + wdIndex;
      holder.appendChild(inner);
      pre.replaceWith(holder);
      try {
        // wavedrom 3.x exposes PascalCase RenderWaveForm (camelCase is 2.x)
        WaveDrom.RenderWaveForm(wdIndex, JSON5.parse(source), 'rx-wd-');
      } catch (e) {
        holder.replaceWith(rxDiagramError('wavedrom', source, e));
      }
      wdIndex++;
    } else if (lang && hljs.getLanguage(lang)) {
      code.className = 'language-' + lang; // aliased fence -> real grammar name
      hljs.highlightElement(code);
    } else if (lang) {
      // unknown fence (e.g. uvm-drill ```check) — plain block with a badge
      pre.dataset.rxLang = lang;
      pre.classList.add('rx-unknown-fence');
    }
  }

  // Render mermaid diagrams one by one so a bad diagram doesn't kill the rest.
  for (const { holder, source } of mermaidJobs) {
    try {
      await mermaid.run({ nodes: [holder], suppressErrors: false });
    } catch (e) {
      holder.replaceWith(rxDiagramError('mermaid', source, e));
    }
  }

  function rxDiagramError(kind, source, err) {
    const box = document.createElement('div');
    box.className = 'rx-diagram-error';
    const msg = document.createElement('p');
    // mermaid throws plain objects with .str; wavedrom/JSON5 throw Errors
    const detail = (err && (err.str || err.message)) || String(err);
    msg.textContent = `${kind} render failed: ${detail}`;
    const pre = document.createElement('pre');
    pre.textContent = source;
    box.append(msg, pre);
    return box;
  }

  rxMakeToolbar({ label: spec.label || 'Markdown', rendered: root, original: srcPre });

  if (typeof rxMountSidebar === 'function') {
    rxMountSidebar({ kind: 'markdown', tocRoot: root });
  }
})();
