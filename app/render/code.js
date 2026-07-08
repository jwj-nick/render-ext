// render-ext code renderer — highlight.js + line-number gutter. Read-only.
'use strict';

(() => {
  if (window.__rxRendered) return;
  window.__rxRendered = true;

  const spec = window.__rxSpec || {};
  const srcPre = document.body.firstElementChild;
  const raw = srcPre.textContent;

  // Above this size highlighting gets slow; show plain text + line numbers.
  const MAX_HIGHLIGHT = 900 * 1024;

  const lines = raw.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();

  const rootDiv = document.createElement('div');
  rootDiv.className = 'rx-code-root';

  const gutter = document.createElement('pre');
  gutter.className = 'rx-gutter';
  gutter.textContent = Array.from({ length: lines.length }, (_, i) => i + 1).join('\n');

  const codePre = document.createElement('pre');
  codePre.className = 'rx-code';
  const code = document.createElement('code');
  code.textContent = raw;

  let note = '';
  const canHighlight =
    raw.length <= MAX_HIGHLIGHT && spec.hljs && hljs.getLanguage(spec.hljs);
  if (canHighlight) {
    code.className = 'language-' + spec.hljs;
    hljs.highlightElement(code);
  } else {
    code.className = 'hljs'; // theme colors/background without grammar
    if (raw.length > MAX_HIGHLIGHT) note = 'large file — highlighting off';
  }

  codePre.appendChild(code);
  rootDiv.append(gutter, codePre);

  srcPre.style.display = 'none';
  document.body.appendChild(rootDiv);
  document.documentElement.classList.add('rx-page', 'rx-page-code');
  document.title = spec.file || document.title;

  rxMakeToolbar({
    label: `${spec.label || 'Code'} · ${lines.length} lines`,
    note,
    rendered: rootDiv,
    original: srcPre
  });
})();
