// render-ext language registry (SSOT).
// Loaded both as a content script (before content/detect.js) and in the
// service worker via importScripts(). Add a new language = add one entry here
// (+ drop its hljs grammar file into libs/ if it is not in the common bundle).
'use strict';

const RX_REGISTRY = {
  // Markdown gets the full pipeline: marked + mermaid + wavedrom + hljs.
  markdownExts: ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdwn', 'mdtxt', 'mdtext'],

  // Code files get hljs highlighting + line numbers.
  // `hljs`: grammar name. `extraLibs`: grammar files NOT in the hljs common
  // bundle (must exist in libs/ and be whitelisted in sw.js).
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

// ext ("sv") -> { kind: 'markdown' } | { kind: 'code', langKey, hljs, label }
function rxLookupExt(ext) {
  if (RX_REGISTRY.markdownExts.includes(ext)) return { kind: 'markdown' };
  for (const [langKey, def] of Object.entries(RX_REGISTRY.languages)) {
    if (def.exts.includes(ext)) {
      return { kind: 'code', langKey, hljs: def.hljs, label: def.label };
    }
  }
  return null;
}
