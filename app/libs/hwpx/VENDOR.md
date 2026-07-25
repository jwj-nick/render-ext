# Vendored from hwpx-tool

Source: `C:\01_Labs\hwpx-tool` @ 90d67ff (synced 2026-07-25)
Upstream stack: zero-dependency vanilla ESM (zip inflate via the built-in
`DecompressionStream`), so nothing needs bundling or building here.

These files are copied VERBATIM so they can be re-synced with a plain copy:

    cp C:/01_Labs/hwpx-tool/src/{zip,xml,xml-tree,extract,header,render,hwpx}.js \
       C:/01_Labs/render-ext/app/libs/hwpx/

render-ext loads them as ES modules with a dynamic `import()` from the
extension origin — see `web_accessible_resources` in `manifest.json` and
`render/render-doc.js`.

Do not edit them here. Fix upstream in hwpx-tool and re-copy, otherwise the two
copies drift and the next sync silently reverts the fix.

Used API: `openHwpx(bytes)` -> document, `parseHeader(headerXml)`,
`renderSection(xml, { header, binUrl })`, `BASE_CSS`. Legacy binary `.hwp`
throws a friendly Korean error, which the viewer surfaces as-is.
