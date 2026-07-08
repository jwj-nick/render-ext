// render-ext service worker — injects the heavy renderer bundle on demand.
// The detector content script (content/detect.js) messages us only when the
// page is a raw text file we know how to render.
'use strict';

importScripts('common/registry.js');

// Everything the Markdown pipeline needs, in load order.
const MD_JS = [
  'libs/marked.min.js',
  'libs/purify.min.js',
  'libs/json5.min.js',
  'libs/highlight.min.js',
  'libs/hljs-verilog.min.js',
  'libs/hljs-vhdl.min.js',
  'libs/hljs-tcl.min.js',
  'libs/wavedrom.min.js',
  'libs/wavedrom-skin-default.js',
  'libs/mermaid.min.js',
  'render/ui.js',
  'render/markdown.js'
];
const MD_CSS = [
  'libs/github-markdown.min.css',
  'styles/hljs-theme.css',
  'styles/base.css'
];

const CODE_CSS = ['styles/hljs-theme.css', 'styles/base.css'];

// Only files listed in the registry may be injected as extra grammars.
const EXTRA_LIB_WHITELIST = new Set(
  Object.values(RX_REGISTRY.languages).flatMap((l) => l.extraLibs || [])
);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!sender.tab || !msg || msg.action !== 'rx-render') return;
  const target = { tabId: sender.tab.id };

  (async () => {
    try {
      if (msg.kind === 'markdown') {
        await chrome.scripting.insertCSS({ target, files: MD_CSS });
        await chrome.scripting.executeScript({ target, files: MD_JS });
      } else if (msg.kind === 'code') {
        const def = RX_REGISTRY.languages[msg.langKey];
        if (!def) throw new Error('unknown langKey: ' + msg.langKey);
        const extra = (def.extraLibs || []).filter((f) => EXTRA_LIB_WHITELIST.has(f));
        await chrome.scripting.insertCSS({ target, files: CODE_CSS });
        await chrome.scripting.executeScript({
          target,
          files: ['libs/highlight.min.js', ...extra, 'render/ui.js', 'render/code.js']
        });
      } else if (msg.kind === 'dirlist') {
        await chrome.scripting.insertCSS({ target, files: ['styles/dirlist.css'] });
        await chrome.scripting.executeScript({ target, files: ['render/dirlist.js'] });
      } else {
        throw new Error('unknown kind: ' + msg.kind);
      }
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();

  return true; // async sendResponse
});
