// render-ext viewer registry (SSOT).
// Loaded as a content script (before content/detect.js) and in the service
// worker via importScripts(). Adding a format = adding one entry here.
'use strict';

const RX_REGISTRY = {
  // Full markdown pipeline: marked + mermaid + wavedrom + hljs.
  markdownExts: ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdwn', 'mdtxt', 'mdtext'],

  // Non-text viewers. `binary: true` means the bytes are fetched as a data URL
  // through the service worker instead of as text.
  viewers: {
    image: {
      exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'apng'],
      label: 'Image',
      binary: true,
      icon: '🖼'
    },
    svg:   { exts: ['svg'], label: 'SVG', icon: '🖼' },
    pdf:   { exts: ['pdf'], label: 'PDF', binary: true, icon: '📕' },
    table: { exts: ['csv', 'tsv'], label: 'Table', icon: '📊' },
    log:   { exts: ['log', 'txt', 'text', 'out', 'rpt', 'err'], label: 'Text / Log', icon: '📃' },

    // documents (zip containers -> read as bytes)
    hwpx:  { exts: ['hwpx'], label: 'HWPX', binary: true, icon: '📘' },
    hwp:   { exts: ['hwp'], label: 'HWP (legacy)', binary: true, icon: '📘' },
    docx:  { exts: ['docx'], label: 'Word', binary: true, icon: '📘' },
    xlsx:  { exts: ['xlsx', 'xlsm', 'xls'], label: 'Excel', binary: true, icon: '📗' },
    pptx:  { exts: ['pptx'], label: 'PowerPoint', binary: true, icon: '📙' },
    notebook: { exts: ['ipynb'], label: 'Jupyter', icon: '📓' }
  },

  // Syntax-highlighted code. `hljs`: grammar name. `extraLibs`: grammar files
  // that are not in the hljs common bundle (must also be listed in sw.js).
  languages: {
    verilog: {
      exts: ['v', 'vh', 'sv', 'svh', 'svi', 'vams', 'f'],
      hljs: 'verilog',
      label: 'Verilog / SystemVerilog',
      extraLibs: ['libs/hljs-verilog.min.js']
    },
    vhdl: {
      exts: ['vhd', 'vhdl'],
      hljs: 'vhdl',
      label: 'VHDL',
      extraLibs: ['libs/hljs-vhdl.min.js']
    },
    tcl: {
      exts: ['tcl', 'sdc', 'xdc', 'upf'],
      hljs: 'tcl',
      label: 'Tcl / SDC',
      extraLibs: ['libs/hljs-tcl.min.js']
    },
    python: { exts: ['py', 'pyw'], hljs: 'python', label: 'Python' },
    json:   { exts: ['json', 'json5', 'jsonl'], hljs: 'json', label: 'JSON' },
    yaml:   { exts: ['yaml', 'yml'], hljs: 'yaml', label: 'YAML' },
    xml:    { exts: ['xml', 'xsd', 'svgz', 'plist'], hljs: 'xml', label: 'XML' },
    c:      { exts: ['c', 'h'], hljs: 'c', label: 'C' },
    cpp:    { exts: ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx', 'inl'], hljs: 'cpp', label: 'C++' },
    javascript: { exts: ['js', 'mjs', 'cjs'], hljs: 'javascript', label: 'JavaScript' },
    typescript: { exts: ['ts', 'mts'], hljs: 'typescript', label: 'TypeScript' },
    shell:  { exts: ['sh', 'bash', 'zsh'], hljs: 'bash', label: 'Shell' },
    makefile: { exts: ['mk', 'makefile'], hljs: 'makefile', label: 'Makefile' },
    ini:    { exts: ['ini', 'toml', 'cfg', 'conf'], hljs: 'ini', label: 'INI / TOML' },
    diff:   { exts: ['diff', 'patch'], hljs: 'diff', label: 'Diff' },
    perl:   { exts: ['pl', 'pm'], hljs: 'perl', label: 'Perl' }
  }
};

// MIME types for binary viewers (file:// responses carry no useful type).
const RX_MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon', avif: 'image/avif',
  apng: 'image/apng', svg: 'image/svg+xml', pdf: 'application/pdf'
};

// ext -> { kind, label, ... } | null
//   kind: 'markdown' | 'code' | 'image' | 'svg' | 'pdf' | 'table' | 'log'
function rxLookupExt(ext) {
  if (RX_REGISTRY.markdownExts.includes(ext)) {
    return { kind: 'markdown', label: 'Markdown', icon: '📄' };
  }
  for (const [kind, def] of Object.entries(RX_REGISTRY.viewers)) {
    if (def.exts.includes(ext)) {
      return {
        kind,
        label: def.label,
        binary: !!def.binary,
        icon: def.icon,
        mime: RX_MIME[ext] || 'application/octet-stream'
      };
    }
  }
  for (const [langKey, def] of Object.entries(RX_REGISTRY.languages)) {
    if (def.exts.includes(ext)) {
      return { kind: 'code', langKey, hljs: def.hljs, label: def.label, icon: '📄' };
    }
  }
  return null;
}
