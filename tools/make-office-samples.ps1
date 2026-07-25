# render-ext: build synthetic .docx / .pptx / .xlsx samples for tests/.
# No Office needed — OOXML is a zip of XML parts, so we write the parts and zip
# them. These are SYNTHETIC fixtures aimed at exercising the viewers; the docx
# and xlsx are complete enough for real readers, the pptx carries only the parts
# our text extractor reads.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$samples = Join-Path (Split-Path $PSScriptRoot -Parent) 'samples'
$tmpRoot = Join-Path $env:TEMP ("rx-office-" + [guid]::NewGuid().ToString('N'))

function New-Part([string]$root, [string]$rel, [string]$content) {
    $p = Join-Path $root $rel
    New-Item -ItemType Directory -Force (Split-Path $p) | Out-Null
    [System.IO.File]::WriteAllText($p, $content, (New-Object System.Text.UTF8Encoding($false)))
}

# Entry names MUST use forward slashes — CreateFromDirectory writes Windows
# separators here, which produces a zip that OOXML readers reject ("could not
# find main document part"). Build the archive entry by entry instead.
function Save-Zip([string]$dir, [string]$out) {
    if (Test-Path $out) { Remove-Item $out }
    $zip = [System.IO.Compression.ZipFile]::Open($out, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        $root = (Resolve-Path $dir).Path.TrimEnd('\') + '\'
        foreach ($f in Get-ChildItem -Recurse -File $dir) {
            $name = $f.FullName.Substring($root.Length).Replace('\', '/')
            $entry = $zip.CreateEntry($name, [System.IO.Compression.CompressionLevel]::Optimal)
            $es = $entry.Open()
            $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
            $es.Write($bytes, 0, $bytes.Length)
            $es.Dispose()
        }
    } finally {
        $zip.Dispose()
    }
    Write-Host ("wrote {0} ({1} bytes)" -f (Split-Path $out -Leaf), (Get-Item $out).Length)
}

# ---------------- docx ----------------
$d = Join-Path $tmpRoot 'docx'
New-Part $d '[Content_Types].xml' @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
'@
New-Part $d '_rels\.rels' @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'@
New-Part $d 'word\document.xml' @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>AXI Arbiter Design Note</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">이 문서는 render-ext의 </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>docx 뷰어</w:t></w:r><w:r><w:t xml:space="preserve"> 검증용 합성 샘플이다.</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>1. Arbitration policy</w:t></w:r></w:p>
    <w:p><w:r><w:t>Round-robin with QoS escalation. A master starved beyond 32 cycles is promoted.</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>write channel: independent pointer</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>read channel: independent pointer</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>2. Known gaps</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:i/></w:rPr><w:t>burst_len == 16 is not covered by directed tests.</w:t></w:r></w:p>
    <w:tbl>
      <w:tr><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>signal</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>width</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>s_axi_awaddr</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>32</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>s_axi_wdata</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>32</w:t></w:r></w:p></w:tc></w:tr>
    </w:tbl>
  </w:body>
</w:document>
'@
Save-Zip $d (Join-Path $samples 'design_note.docx')

# ---------------- pptx (parts our extractor reads) ----------------
$p = Join-Path $tmpRoot 'pptx'
New-Part $p '[Content_Types].xml' @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>
'@
New-Part $p '_rels\.rels' @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>
'@
New-Part $p 'ppt\presentation.xml' @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst>
</p:presentation>
'@
$slide = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:txBody>
      <a:p><a:r><a:t>__TITLE__</a:t></a:r></a:p>
      <a:p><a:r><a:t>__L1__</a:t></a:r></a:p>
      <a:p><a:r><a:t>__L2__</a:t></a:r></a:p>
    </p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>
'@
New-Part $p 'ppt\slides\slide1.xml' ($slide -replace '__TITLE__','NPU Datapath Review' -replace '__L1__','MAC array utilization drops on FC layers' -replace '__L2__','Weight reuse is the limiting factor')
New-Part $p 'ppt\slides\slide2.xml' ($slide -replace '__TITLE__','Next Steps' -replace '__L1__','Directed tests for burst_len == 16' -replace '__L2__','Revisit CBUF handshake coverage')
Save-Zip $p (Join-Path $samples 'review_deck.pptx')

Remove-Item -Recurse -Force $tmpRoot
