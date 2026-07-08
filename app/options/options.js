// render-ext options/popup — chrome.storage.sync 기반 on/off 설정.
// options_ui 페이지와 action 팝업이 이 파일 하나를 공유한다.
'use strict';

const DEFAULTS = { enabled: true, markdown: true, code: true, sidebar: true, dirlist: true };
const KEYS = Object.keys(DEFAULTS);

const group = document.getElementById('group');

function syncGroup() {
  group.classList.toggle('off', !document.getElementById('enabled').checked);
}

chrome.storage.sync.get(DEFAULTS, (cfg) => {
  for (const k of KEYS) document.getElementById(k).checked = !!cfg[k];
  syncGroup();
});

for (const k of KEYS) {
  document.getElementById(k).addEventListener('change', (e) => {
    chrome.storage.sync.set({ [k]: e.target.checked });
    if (k === 'enabled') syncGroup();
  });
}
