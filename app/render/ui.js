// render-ext shared UI — floating toolbar (label + Raw/Rendered toggle).
// Injected before render/markdown.js or render/code.js.
'use strict';

function rxMakeToolbar({ label, note, rendered, original }) {
  const bar = document.createElement('div');
  bar.className = 'rx-toolbar';

  const tag = document.createElement('span');
  tag.className = 'rx-toolbar-label';
  tag.textContent = label + (note ? ' · ' + note : '');
  bar.appendChild(tag);

  const btn = document.createElement('button');
  btn.className = 'rx-toolbar-btn';
  btn.type = 'button';
  let showingRaw = false;
  const sync = () => {
    btn.textContent = showingRaw ? 'Rendered' : 'Raw';
    rendered.style.display = showingRaw ? 'none' : '';
    original.style.display = showingRaw ? '' : 'none';
  };
  btn.addEventListener('click', () => {
    showingRaw = !showingRaw;
    sync();
  });
  sync();
  bar.appendChild(btn);

  document.body.appendChild(bar);
  return bar;
}
