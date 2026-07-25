// render-ext service worker.
//  - rx-fetch:  read a file:// / http(s) URL's text on behalf of a content
//    script (content scripts have a null origin on file:// and are CORS-blocked;
//    the SW runs with the extension origin + file access and can read it).
//  - rx-render: inject the viewer app bundle into the detected raw-file / dir
//    tab. One bundle handles Markdown, code, and directory browsing.
'use strict';

const APP_JS = [
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
  'render/render-md.js',
  'render/render-code.js',
  'render/render-media.js',
  'render/sidebar.js',
  'render/app.js'
];
const APP_CSS = [
  'libs/github-markdown.min.css',
  'styles/hljs-theme.css',
  'styles/sidebar.css',
  'styles/base.css'
];

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.action === 'rx-fetch') {
    (async () => {
      try {
        const res = await fetch(msg.url);
        const text = await res.text();
        sendResponse({ ok: true, text });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  // Binary read (images, PDF, office/zip containers). Returned as a base64
  // data URL: message passing cannot carry an ArrayBuffer, and a data: URL is
  // also immune to the file:// subresource restrictions a file:// page has.
  if (msg.action === 'rx-fetch-bin') {
    (async () => {
      try {
        const res = await fetch(msg.url);
        const buf = await res.arrayBuffer();
        const MAX = 48 * 1024 * 1024;
        if (buf.byteLength > MAX) throw new Error('file too large: ' + buf.byteLength + ' bytes');
        const bytes = new Uint8Array(buf);
        const CHUNK = 0x8000;
        let bin = '';
        for (let i = 0; i < bytes.length; i += CHUNK) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
        }
        sendResponse({
          ok: true,
          b64: btoa(bin),
          mime: msg.mime || 'application/octet-stream',
          size: buf.byteLength
        });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg.action === 'rx-render') {
    if (!sender.tab) return;
    const target = { tabId: sender.tab.id };
    (async () => {
      try {
        await chrome.scripting.insertCSS({ target, files: APP_CSS });
        await chrome.scripting.executeScript({ target, files: APP_JS });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
});
