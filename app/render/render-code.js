// render-ext code renderer — pure: takes text, returns a DOM node.
// highlight.js + line-number gutter. Read-only. No document.body writes.
'use strict';

function rxRenderCode(raw, spec) {
  spec = spec || {};
  const MAX_HIGHLIGHT = 900 * 1024;

  const lines = raw.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();

  const root = document.createElement('div');
  root.className = 'rx-code-root';

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
    code.className = 'hljs';
    if (raw.length > MAX_HIGHLIGHT) note = 'large file — highlighting off';
  }

  codePre.appendChild(code);
  root.append(gutter, codePre);
  return { node: root, title: spec.file || '', note, lines: lines.length };
}
