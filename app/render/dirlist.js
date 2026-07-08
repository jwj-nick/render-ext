// render-ext directory-listing enhancer (file:// index pages).
// Adds a clickable breadcrumb bar (jump to any ancestor folder), a filename
// filter box, an item counter, and dark-mode styling (via dirlist.css).
// Chrome's native listing (sortable table, [parent directory]) stays intact.
'use strict';

(() => {
  if (window.__rxDirRendered) return;
  window.__rxDirRendered = true;

  document.documentElement.classList.add('rx-dir');

  // --- breadcrumb --------------------------------------------------------
  // pathname: /C:/01_Labs/render-ext/samples/  ->  C: > 01_Labs > ...
  const segs = decodeURIComponent(location.pathname).split('/').filter(Boolean);

  const bar = document.createElement('div');
  bar.className = 'rx-dir-bar';

  const crumbs = document.createElement('nav');
  crumbs.className = 'rx-crumbs';

  let acc = 'file:///';
  segs.forEach((seg, i) => {
    acc += seg + '/';
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'rx-crumb-sep';
      sep.textContent = '›';
      crumbs.appendChild(sep);
    }
    if (i === segs.length - 1) {
      const cur = document.createElement('span');
      cur.className = 'rx-crumb rx-crumb-current';
      cur.textContent = seg;
      crumbs.appendChild(cur);
    } else {
      const a = document.createElement('a');
      a.className = 'rx-crumb';
      a.href = acc;
      a.textContent = seg;
      crumbs.appendChild(a);
    }
  });
  bar.appendChild(crumbs);

  // --- filter box + counter ----------------------------------------------
  const rows = () =>
    [...document.querySelectorAll('table tr')].filter((tr) => tr.querySelector('td'));

  const box = document.createElement('div');
  box.className = 'rx-dir-tools';

  const input = document.createElement('input');
  input.className = 'rx-dir-filter';
  input.type = 'search';
  input.placeholder = 'filter… ( / )';

  const count = document.createElement('span');
  count.className = 'rx-dir-count';

  const applyFilter = () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    let total = 0;
    for (const tr of rows()) {
      total++;
      const name = (tr.querySelector('td')?.textContent || '').toLowerCase();
      const ok = !q || name.includes(q);
      tr.style.display = ok ? '' : 'none';
      if (ok) shown++;
    }
    count.textContent = q ? `${shown} / ${total}` : `${total} items`;
  };
  input.addEventListener('input', applyFilter);

  // "/" focuses the filter (like GitHub)
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    } else if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      applyFilter();
      input.blur();
    }
  });

  box.append(input, count);
  bar.appendChild(box);
  document.body.prepend(bar);

  // Chrome streams rows in as the listing loads — recount when they settle.
  applyFilter();
  new MutationObserver(applyFilter)
    .observe(document.querySelector('table') || document.body, {
      childList: true,
      subtree: true
    });
})();
