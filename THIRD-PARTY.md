# Third-party notices

render-ext ships every rendering library locally — Manifest V3 forbids loading
code from a CDN — so the files below live in `app/libs/` and are redistributed
as part of the extension. Each retains its own copyright and license; the
minified files keep their upstream license headers.

| Library | Version | License | Upstream |
|---|---|---|---|
| marked | 15.0.12 | MIT | https://github.com/markedjs/marked |
| DOMPurify | 3.4.11 | Apache-2.0 OR MPL-2.0 | https://github.com/cure53/DOMPurify |
| Mermaid | 11.x | MIT | https://github.com/mermaid-js/mermaid |
| WaveDrom | 3.6.1 | MIT | https://github.com/wavedrom/wavedrom |
| highlight.js (+ verilog / vhdl / tcl grammars) | 11.11.1 | BSD-3-Clause | https://github.com/highlightjs/highlight.js |
| JSON5 | 2.x | MIT | https://github.com/json5/json5 |
| github-markdown-css | 5.x | MIT | https://github.com/sindresorhus/github-markdown-css |
| mammoth.js | 1.x | BSD-2-Clause | https://github.com/mwilliamson/mammoth.js |
| SheetJS (xlsx) | 0.18.5 | Apache-2.0 | https://github.com/SheetJS/sheetjs |
| Viz.js | 3.14.0 | MIT | https://github.com/mdaines/viz-js |
| ↳ bundled inside Viz.js: Graphviz | — | EPL-1.0 | https://graphviz.org |
| ↳ bundled inside Viz.js: Expat | — | MIT | https://libexpat.github.io |
| pako | 2.x | MIT | https://github.com/nodeca/pako |

## Vendored from another project of mine

`app/libs/hwpx/` is the HWPX engine from **hwpx-tool**, copied verbatim rather
than rewritten so the two stay in sync. See `app/libs/hwpx/VENDOR.md` for the
source commit and the re-sync command. It is zero-dependency vanilla ESM and
carries the same license as this repository.

## Sample files

`samples/` contains files used to exercise the viewers. Some are third-party —
see `samples/NOTICE.md` for provenance and licensing.
