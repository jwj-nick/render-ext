# render-ext: register text/plain MIME for extensions Chrome doesn't know.
#
# Why: for file:// URLs Chrome resolves MIME from the OS. Unknown extensions
# (.sv, .v, .md on a clean Windows, ...) become application/octet-stream and
# Chrome DOWNLOADS the file instead of displaying it — the extension never
# gets a chance to render.
#
# What it does: writes only the "Content Type"="text/plain" value under
# HKCU\Software\Classes\.<ext>. Per-user (no admin), does NOT touch default
# file associations, and skips any extension that already has a Content Type.
# Restart Chrome afterwards.
#
# Undo: remove the value, e.g.
#   Remove-ItemProperty -Path HKCU:\Software\Classes\.sv -Name 'Content Type'

$exts = @(
    # markdown
    'md', 'markdown', 'mdown', 'mkd',
    # verilog / systemverilog / vhdl / eda
    'v', 'vh', 'sv', 'svh', 'svi', 'vams', 'f', 'vhd', 'vhdl',
    'tcl', 'sdc', 'xdc', 'upf',
    # config / data
    'yaml', 'yml', 'json5', 'jsonl', 'toml', 'cfg', 'conf', 'ini',
    # c/c++
    'c', 'h', 'cpp', 'hpp', 'cc', 'hh', 'cxx', 'hxx', 'inl',
    # misc
    'py', 'pyw', 'mk', 'diff', 'patch', 'pl', 'pm', 'log'
)

foreach ($e in $exts) {
    $key = "HKCU:\Software\Classes\.$e"
    if (-not (Test-Path $key)) {
        New-Item -Path $key -Force | Out-Null
    }
    $existing = (Get-ItemProperty -Path $key -Name 'Content Type' -ErrorAction SilentlyContinue).'Content Type'
    if ($existing) {
        Write-Host "skip  .$e  (already: $existing)"
    } else {
        Set-ItemProperty -Path $key -Name 'Content Type' -Value 'text/plain'
        Write-Host "set   .$e  -> text/plain"
    }
}

Write-Host ""
Write-Host "Done. Restart Chrome for the changes to take effect."
