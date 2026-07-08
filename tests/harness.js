// render-ext harness — runs the SAME pipeline as render/markdown.js against
// the SAME bundled libs, and reports PASS/FAIL to the DOM + console.
// Open tests/harness.html via file:// (no extension needed).
'use strict';

const MD = `---
title: harness
level: L1
---

# Harness Doc

:::tldr
callout body with **bold**
:::

\`\`\`mermaid
flowchart LR
    A[detect] --> B{sw}
    B --> C[render]
\`\`\`

\`\`\`mermaid
sequenceDiagram
    participant A
    participant B
    A->>B: hello
\`\`\`

\`\`\`mermaid
flowchart LR
    A --> ( broken syntax
\`\`\`

\`\`\`wavedrom
{ signal: [
  { name: "clk",  wave: "p......." },
  { name: "req",  wave: "0.1..0.." },
  { name: "data", wave: "x..=..x.", data: ["D0"] }
]}
\`\`\`

\`\`\`systemverilog
module m #(parameter W = 8)(
  input  logic clk,
  output logic [W-1:0] q
);
  always_ff @(posedge clk) q <= q + 1'b1;
endmodule
\`\`\`

\`\`\`sv
interface bus_if(input logic clk);
  logic valid, ready;
endinterface
\`\`\`

\`\`\`python
def f(x: int) -> int:
    return x * 2
\`\`\`

\`\`\`check
Q: unknown fence?
A: badge only.
\`\`\`

<script>document.title = "xss";<\/script>
`;

const results = [];
function t(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
}

(async () => {
  try {
    // -- 1. globals / grammars -------------------------------------------
    t('globals: marked/DOMPurify/JSON5/hljs/WaveDrom/WaveSkin/mermaid',
      !!(window.marked && window.DOMPurify && window.JSON5 && window.hljs &&
         window.WaveDrom && window.WaveSkin && window.mermaid));
    t('hljs grammar: verilog', !!hljs.getLanguage('verilog'));
    t('hljs alias: sv -> verilog', !!hljs.getLanguage('sv'));
    t('hljs grammars: python/json/yaml/cpp/vhdl/tcl',
      !!(hljs.getLanguage('python') && hljs.getLanguage('json') &&
         hljs.getLanguage('yaml') && hljs.getLanguage('cpp') &&
         hljs.getLanguage('vhdl') && hljs.getLanguage('tcl')));

    // -- 2. front matter + callout (same regexes as markdown.js) ---------
    let text = MD;
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    t('front matter detected', !!fm);
    if (fm) text = text.slice(fm[0].length);

    text = text.replace(
      /^:::[ \t]*([A-Za-z][\w-]*)[^\n]*\r?\n([\s\S]*?)\r?\n:::[ \t]*$/gm,
      (_, name, body) =>
        `<div class="rx-callout rx-callout-${name.toLowerCase()}">` +
        `<p class="rx-callout-title">${name.toUpperCase()}</p>\n\n${body}\n\n</div>`
    );

    // -- 3. marked + DOMPurify -------------------------------------------
    marked.setOptions({ gfm: true, breaks: false });
    const dirty = marked.parse(text);
    const clean = DOMPurify.sanitize(dirty);
    t('DOMPurify strips <script>', !clean.toLowerCase().includes('<script'));

    const root = document.getElementById('md');
    root.innerHTML = clean;
    t('callout rendered (div.rx-callout-tldr)', !!root.querySelector('.rx-callout-tldr'));
    t('callout body markdown parsed (bold)',
      !!root.querySelector('.rx-callout-tldr strong'));

    const codes = [...root.querySelectorAll('pre > code')];
    const langOf = (c) =>
      ([...c.classList].find((x) => x.startsWith('language-')) || '').slice(9);
    t('fenced blocks parsed (>= 8)', codes.length >= 8, 'got ' + codes.length);

    // -- 4. mermaid (2 valid + 1 intentionally broken) --------------------
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });
    let mermaidOK = 0;
    let mermaidErrCaught = false;
    for (const code of codes.filter((c) => langOf(c) === 'mermaid')) {
      const holder = document.createElement('div');
      holder.className = 'mermaid rx-diagram';
      holder.textContent = code.textContent;
      code.parentElement.replaceWith(holder);
      try {
        await mermaid.run({ nodes: [holder], suppressErrors: false });
        if (holder.querySelector('svg')) mermaidOK++;
      } catch (e) {
        mermaidErrCaught = true;
        holder.textContent = '(intended mermaid error caught: ' + String(e).slice(0, 60) + ')';
      }
    }
    t('mermaid: 2 valid diagrams -> svg', mermaidOK === 2, 'svg count = ' + mermaidOK);
    t('mermaid: broken diagram error caught (isolation)', mermaidErrCaught);

    // -- 5. wavedrom -------------------------------------------------------
    const wd = codes.find((c) => langOf(c) === 'wavedrom');
    let wdOK = false;
    let wdDetail = 'no wavedrom fence';
    if (wd) {
      const holder = document.createElement('div');
      holder.className = 'rx-diagram rx-wavedrom';
      const inner = document.createElement('div');
      inner.id = 'rx-wd-0';
      holder.appendChild(inner);
      wd.parentElement.replaceWith(holder);
      try {
        WaveDrom.RenderWaveForm(0, JSON5.parse(wd.textContent), 'rx-wd-');
        wdOK = !!holder.querySelector('svg');
        wdDetail = wdOK ? 'svg rendered' : 'no svg produced';
      } catch (e) {
        wdDetail = String(e);
      }
    }
    t('wavedrom: JSON5 parse + RenderWaveForm -> svg', wdOK, wdDetail);

    // -- 6. hljs highlighting (incl. systemverilog alias fix) -------------
    const FENCE_ALIAS = { systemverilog: 'verilog' };
    let svAliasOK = false;
    let svDirectOK = false;
    let pyOK = false;
    for (const code of codes) {
      let lang = langOf(code);
      const orig = lang;
      lang = FENCE_ALIAS[lang] || lang;
      if (!lang || !hljs.getLanguage(lang)) continue;
      code.className = 'language-' + lang;
      hljs.highlightElement(code);
      const hasSpans = !!code.querySelector('.hljs-keyword, .hljs-title, .hljs-string');
      if (orig === 'systemverilog') svAliasOK = hasSpans;
      if (orig === 'sv') svDirectOK = hasSpans;
      if (orig === 'python') pyOK = hasSpans;
    }
    t('hljs: ```systemverilog highlighted via alias', svAliasOK);
    t('hljs: ```sv highlighted (uvm-drill fence)', svDirectOK);
    t('hljs: ```python highlighted', pyOK);

    // -- 7. code-view path: highlight a raw verilog string ----------------
    const rawV = 'module top(input clk); wire [7:0] d; assign d = 8\'hFF; endmodule';
    const hl = hljs.highlight(rawV, { language: 'verilog' });
    t('code view: hljs.highlight(verilog) emits markup',
      hl.value.includes('hljs-keyword'));
  } catch (e) {
    t('UNEXPECTED HARNESS ERROR', false, String(e && e.stack || e));
  }

  // -- report -------------------------------------------------------------
  const list = document.getElementById('list');
  let pass = 0;
  for (const r of results) {
    const li = document.createElement('li');
    li.className = r.ok ? 'pass' : 'fail';
    li.textContent = r.name + (r.detail ? '' : '');
    if (r.detail) {
      const s = document.createElement('span');
      s.className = 'detail';
      s.textContent = '  — ' + r.detail;
      li.appendChild(s);
    }
    list.appendChild(li);
    if (r.ok) pass++;
    console.log(`[RX-TEST] ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  }
  const summary = `${pass}/${results.length} PASS`;
  document.getElementById('summary').textContent = summary;
  console.log(`[RX-TEST] SUMMARY ${summary}`);
})();
