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

    // -- 8. sidebar helpers (directory parsing / path math) ---------------
    t('sidebar: helpers defined',
      typeof rxParseListing === 'function' && typeof rxParentDir === 'function' &&
      typeof rxUnescapeJs === 'function' && typeof rxExtOf === 'function');

    const LISTING =
      '<script>start("/C:/proj/");<\/script>' +
      '<script>onHasParentDirectory();<\/script>' +
      '<script>addRow("..","..",1,"","");<\/script>' +
      '<script>addRow("sub","sub/",1,0,"","2026");<\/script>' +
      '<script>addRow("readme.md","readme.md",0,120,"120 B","2026");<\/script>' +
      '<script>addRow("top.sv","top.sv",0,900,"900 B","2026");<\/script>' +
      '<script>addRow("weird\\x20name.v","weird%20name.v",0,10,"10 B","2026");<\/script>';
    const parsed = rxParseListing(LISTING);
    t('sidebar: parses listing, drops "..", keeps 4', parsed.length === 4,
      'names=' + parsed.map((e) => e.name).join('|'));
    t('sidebar: folder flagged isDir', parsed[0].name === 'sub' && parsed[0].isDir === true);
    t('sidebar: file flagged !isDir', parsed[1].name === 'readme.md' && parsed[1].isDir === false);
    t('sidebar: JS \\x escape unescaped', parsed.some((e) => e.name === 'weird name.v'),
      'got ' + JSON.stringify(parsed.map((e) => e.name)));

    t('sidebar: parentDir climbs one level',
      rxParentDir('file:///C:/a/b/') === 'file:///C:/a/');
    t('sidebar: parentDir of drive -> file:///',
      rxParentDir('file:///C:/') === 'file:///');
    t('sidebar: parentDir null at file:///',
      rxParentDir('file:///') === null);
    t('sidebar: parentDir null for http',
      rxParentDir('http://x/y/') === null);

    t('sidebar: rxExtOf', rxExtOf('a/b/Top.SV') === 'sv' && rxExtOf('noext') === '');

    // -- 9. rxChildUrl (the slash-drop bug: dir + entry -> absolute URL) ---
    t('childUrl: folder with trailing slash',
      rxChildUrl('file:///C:/idea/', { url: 'migration/', isDir: true }) === 'file:///C:/idea/migration/');
    t('childUrl: folder WITHOUT trailing slash gets one',
      rxChildUrl('file:///C:/idea/', { url: 'migration', isDir: true }) === 'file:///C:/idea/migration/');
    t('childUrl: file keeps the separating slash',
      rxChildUrl('file:///C:/idea/', { url: '2026-06-27_ai-build-lab-plan.md', isDir: false }) ===
        'file:///C:/idea/2026-06-27_ai-build-lab-plan.md');
    t('childUrl: base missing slash is normalized',
      rxChildUrl('file:///C:/idea', { url: '2026.md', isDir: false }) === 'file:///C:/idea/2026.md');
    t('childUrl: encoded space preserved',
      rxChildUrl('file:///C:/my%20dir/', { url: 'a%20b.md', isDir: false }) === 'file:///C:/my%20dir/a%20b.md');
    t('childUrl: parent (up) passed through',
      rxChildUrl('file:///C:/idea/migration/', { up: true, url: 'file:///C:/idea/' }) === 'file:///C:/idea/');

    // -- 10. registry: new viewer kinds ------------------------------------
    t('registry: png -> image (binary)',
      rxLookupExt('png').kind === 'image' && rxLookupExt('png').binary === true);
    t('registry: svg -> svg (text)',
      rxLookupExt('svg').kind === 'svg' && !rxLookupExt('svg').binary);
    t('registry: pdf -> pdf (binary)',
      rxLookupExt('pdf').kind === 'pdf' && rxLookupExt('pdf').binary === true);
    t('registry: csv -> table, log -> log',
      rxLookupExt('csv').kind === 'table' && rxLookupExt('log').kind === 'log');
    t('registry: sv still code/verilog',
      rxLookupExt('sv').kind === 'code' && rxLookupExt('sv').hljs === 'verilog');
    t('registry: html NOT claimed (opens in a new tab)', rxLookupExt('html') === null);

    // -- 11. CSV parser -----------------------------------------------------
    const csv = 'a,b,c\n1,"x,y",3\n2,"he said ""hi""",4\n5,"multi\nline",6\n';
    const rows = rxParseDelimited(csv, ',');
    t('csv: row count', rows.length === 4, 'got ' + rows.length);
    t('csv: quoted comma kept in one field', rows[1][1] === 'x,y', JSON.stringify(rows[1]));
    t('csv: doubled quote unescaped', rows[2][1] === 'he said "hi"', JSON.stringify(rows[2]));
    t('csv: newline inside quotes', rows[3][1] === 'multi\nline', JSON.stringify(rows[3]));
    t('csv: BOM stripped', rxParseDelimited('\ufeffa,b\n1,2\n', ',')[0][0] === 'a');
    t('csv: delimiter guess (comma / tab / semicolon)',
      rxGuessDelim('a,b,c\n', 'csv') === ',' &&
      rxGuessDelim('a\tb\tc\n', 'csv') === '\t' &&
      rxGuessDelim('a;b;c\n', 'csv') === ';');
    t('csv: guess ignores separators inside quotes',
      rxGuessDelim('"a;b;c;d"\tx\n', 'csv') === '\t');

    // -- 12. ANSI parser ----------------------------------------------------
    const ansi = 'plain \x1b[31mred\x1b[0m \x1b[1;32mboldgreen\x1b[0m end';
    const segs = rxParseAnsi(ansi);
    const joined = segs.map((s) => s.text).join('');
    t('ansi: escape codes removed from text',
      joined === 'plain red boldgreen end', JSON.stringify(joined));
    t('ansi: red segment classed', segs.some((s) => s.text === 'red' && s.cls === 'rx-fg1'),
      JSON.stringify(segs.map((s) => [s.text, s.cls])));
    t('ansi: bold+green combined',
      segs.some((s) => s.text === 'boldgreen' && s.cls.includes('rx-fg2') && s.cls.includes('rx-b')));
    t('ansi: reset clears state', segs[segs.length - 1].cls === '');
    t('ansi: bright fg (90-97) mapped', rxParseAnsi('\x1b[91mx')[0].cls === 'rx-fg9');
    t('ansi: cursor-move escapes swallowed',
      rxParseAnsi('a\x1b[2Kb').map((s) => s.text).join('') === 'ab');
    t('ansi: detector', rxHasAnsi('x\x1b[31my') && !rxHasAnsi('plain text'));

    // -- 13. document formats (phase 2) ------------------------------------
    t('registry: hwpx/docx/xlsx/pptx are binary docs',
      rxLookupExt('hwpx').kind === 'hwpx' && rxLookupExt('hwpx').binary === true &&
      rxLookupExt('docx').binary === true && rxLookupExt('xlsx').binary === true &&
      rxLookupExt('pptx').binary === true);
    t('registry: ipynb is text (notebook)',
      rxLookupExt('ipynb').kind === 'notebook' && !rxLookupExt('ipynb').binary);
    t('doc libs present: mammoth + XLSX',
      typeof mammoth !== 'undefined' && typeof XLSX !== 'undefined');
    t('doc renderers defined',
      typeof rxRenderHwpx === 'function' && typeof rxRenderDocx === 'function' &&
      typeof rxRenderXlsx === 'function' && typeof rxRenderPptx === 'function' &&
      typeof rxRenderNotebook === 'function');

    // notebook rendering (no network / no libs beyond marked+hljs)
    const NB = JSON.stringify({
      cells: [
        { cell_type: 'markdown', source: ['# NB Title\n', '\n', 'body **bold**'] },
        { cell_type: 'code', execution_count: 7, source: ['x = 1\n', 'print(x)'],
          outputs: [
            { output_type: 'stream', name: 'stdout', text: ['1\n'] },
            { output_type: 'error', ename: 'ValueError', evalue: 'boom',
              traceback: ['\x1b[1;31mValueError\x1b[0m: boom'] }
          ] }
      ],
      metadata: { language_info: { name: 'python' } }
    });
    const nb = await rxRenderNotebook(NB, { file: 'x.ipynb' });
    t('notebook: title from first h1', nb.title === 'NB Title', 'got ' + nb.title);
    t('notebook: cell count in note', /2 cells \(1 code\)/.test(nb.note), nb.note);
    t('notebook: markdown cell rendered', !!nb.node.querySelector('.rx-nb-md strong'));
    t('notebook: code highlighted', !!nb.node.querySelector('.rx-nb-code .hljs-built_in, .rx-nb-code .hljs-keyword, .rx-nb-code .hljs-number'));
    t('notebook: prompt shows execution count',
      (nb.node.querySelector('.rx-nb-prompt') || {}).textContent === 'In [7]:');
    t('notebook: stdout output present',
      [...nb.node.querySelectorAll('.rx-nb-stream')].some((p) => p.textContent.trim() === '1'));
    t('notebook: error traceback ANSI-coloured',
      !!nb.node.querySelector('.rx-nb-stderr .rx-fg1, .rx-nb-stderr .rx-b'));

    // hwpx: vendored engine loads and renders the real sample
    // (rxFetchBinary falls back to XHR here — fetch() cannot read file://)
    try {
      const bin = await rxFetchBinary('../samples/sample.hwpx', 'application/hwp+zip');
      const hw = await rxRenderHwpx(rxB64ToBytes(bin.b64), { file: 'sample.hwpx' });
      t('hwpx: engine renders sample', !!hw.node.querySelector('.hwpx-page'), hw.note);
      t('hwpx: title from document metadata',
        /synthetic/.test(hw.title), 'title=' + hw.title);
      t('hwpx: Korean text present', /합성 샘플|샘플/.test(hw.node.textContent));
    } catch (e) {
      t('hwpx: engine renders sample', false, String(e));
    }

    // legacy binary .hwp must fail with the friendly message, not a crash
    try {
      const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]);
      await rxRenderHwpx(ole, { file: 'old.hwp' });
      t('hwp: legacy binary rejected with a message', false, 'no error thrown');
    } catch (e) {
      t('hwp: legacy binary rejected with a message', /구형 바이너리/.test(e.message), e.message);
    }

    // -- 14. standalone diagrams (phase 3) ---------------------------------
    t('registry: diagram kinds',
      rxLookupExt('dot').kind === 'dot' && rxLookupExt('gv').kind === 'dot' &&
      rxLookupExt('mmd').kind === 'mermaid' && rxLookupExt('wd').kind === 'wavedrom' &&
      rxLookupExt('drawio').kind === 'drawio' && rxLookupExt('puml').kind === 'plantuml');

    // graphviz (harness runs the WASM engine directly; the extension uses the SW)
    try {
      const g = await rxRenderDot('digraph { a -> b; b -> c; }', { file: 't.dot' });
      const svgEl = g.node.querySelector('svg');
      t('graphviz: dot -> svg', !!svgEl, svgEl ? 'svg present' : 'no svg');
      t('graphviz: node labels rendered',
        /a[\s\S]*b[\s\S]*c/.test(g.node.textContent), JSON.stringify(g.node.textContent.trim().slice(0, 40)));
    } catch (e) {
      t('graphviz: dot -> svg', false, String(e));
    }

    // draw.io: plain XML and compressed payloads must both decode
    const DIO_PLAIN = `<mxfile><diagram id="d"><mxGraphModel><root>
      <mxCell id="0"/><mxCell id="1" parent="0"/>
      <mxCell id="n1" value="Alpha" style="rounded=1;fillColor=#ddf4ff;" vertex="1" parent="1">
        <mxGeometry x="10" y="10" width="100" height="40" as="geometry"/></mxCell>
      <mxCell id="n2" value="Beta" style="shape=ellipse;" vertex="1" parent="1">
        <mxGeometry x="200" y="10" width="100" height="40" as="geometry"/></mxCell>
      <mxCell id="e1" value="link" edge="1" parent="1" source="n1" target="n2">
        <mxGeometry as="geometry"/></mxCell>
      </root></mxGraphModel></diagram></mxfile>`;
    const dio = rxRenderDrawio(DIO_PLAIN, { file: 'x.drawio' });
    t('drawio: shapes and edges counted', /2 shapes \/ 1 edges/.test(dio.note), dio.note);
    t('drawio: rect + ellipse emitted',
      !!dio.node.querySelector('svg rect') && !!dio.node.querySelector('svg ellipse'));
    t('drawio: labels emitted',
      /Alpha/.test(dio.node.textContent) && /Beta/.test(dio.node.textContent));
    t('drawio: edge polyline with arrow',
      !!dio.node.querySelector('svg polyline[marker-end]'));

    // compressed variant: deflateRaw + base64 + URL-encoding, like drawio saves
    const inner = DIO_PLAIN.match(/<mxGraphModel>[\s\S]*<\/mxGraphModel>/)[0];
    const deflated = pako.deflateRaw(new TextEncoder().encode(encodeURIComponent(inner)));
    let b64 = '';
    for (const byte of deflated) b64 += String.fromCharCode(byte);
    const compressed = '<mxfile><diagram id="d">' + btoa(b64) + '</diagram></mxfile>';
    const dio2 = rxRenderDrawio(compressed, { file: 'y.drawio' });
    t('drawio: compressed payload decoded', /2 shapes/.test(dio2.note), dio2.note);

    // plantuml: encoder + the opt-in gate
    const pumlOff = rxRenderPlantuml('@startuml\nA -> B\n@enduml', { file: 'a.puml' }, false);
    t('plantuml: off by default shows source, no button',
      !pumlOff.node.querySelector('button') && /설정에서/.test(pumlOff.node.textContent));
    const pumlOn = rxRenderPlantuml('@startuml\nA -> B\n@enduml', { file: 'a.puml' }, true);
    t('plantuml: opt-in shows an explicit send button',
      !!pumlOn.node.querySelector('button') && /plantuml\.com/.test(pumlOn.node.textContent));
    t('plantuml: encoder emits the custom alphabet',
      /^[0-9A-Za-z_-]+$/.test(rxPlantumlEncode('@startuml\nA -> B\n@enduml')));
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
