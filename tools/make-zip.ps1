# render-ext: build a release zip for no-build distribution.
# Output: dist/render-ext-v<version>.zip  (version read from app/manifest.json)
#
# Zip layout — users unzip and "Load unpacked" the inner render-ext/ folder:
#   render-ext/
#     manifest.json, sw.js, common/, content/, render/, styles/, libs/,
#     options/, icons/            <- the extension itself (= app/)
#     INSTALL.md                  <- setup guide (copied from repo root)
#     setup/register-mime.ps1     <- Windows MIME one-time setup

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path $PSScriptRoot -Parent

$manifest = Get-Content (Join-Path $root 'app\manifest.json') -Raw | ConvertFrom-Json
$ver = $manifest.version

# The displayed name carries the version (see tools/set-version.ps1) — refuse to
# ship a zip whose card would show the wrong build.
if ($manifest.name -notmatch [regex]::Escape("v$ver") + '$') {
    throw "manifest name '$($manifest.name)' does not end with v$ver — run .\tools\set-version.ps1 $ver first"
}

$stage = Join-Path $env:TEMP "render-ext-zip-stage"
$pkg = Join-Path $stage 'render-ext'
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $pkg | Out-Null

Copy-Item -Recurse (Join-Path $root 'app\*') $pkg
Copy-Item (Join-Path $root 'INSTALL.md') $pkg
New-Item -ItemType Directory -Force (Join-Path $pkg 'setup') | Out-Null
Copy-Item (Join-Path $root 'tools\register-mime.ps1') (Join-Path $pkg 'setup')

$distDir = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $distDir | Out-Null
$zip = Join-Path $distDir "render-ext-v$ver.zip"
if (Test-Path $zip) { Remove-Item -Force $zip }

# Entry names MUST use forward slashes. Windows PowerShell 5.1's
# Compress-Archive stores backslashes, which violates the zip spec: Explorer
# copes, but 7-Zip / macOS / Linux then extract one flat file literally named
# "render-ext\manifest.json" and the unpacked extension will not load. Build the
# archive entry by entry so the separators are ours to control.
$zipFile = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
try {
    $base = (Resolve-Path $stage).Path.TrimEnd('\') + '\'
    foreach ($f in Get-ChildItem -Recurse -File $stage) {
        $name = $f.FullName.Substring($base.Length).Replace('\', '/')
        $entry = $zipFile.CreateEntry($name, [System.IO.Compression.CompressionLevel]::Optimal)
        $out = $entry.Open()
        $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
        $out.Write($bytes, 0, $bytes.Length)
        $out.Dispose()
    }
} finally {
    $zipFile.Dispose()
}

# Verify before shipping: every entry must use '/' and manifest.json must be there.
$check = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
    $bad = @($check.Entries | Where-Object { $_.FullName -like '*\*' })
    if ($bad.Count) { throw "$($bad.Count) zip entries use backslashes" }
    if (-not ($check.Entries | Where-Object { $_.FullName -eq 'render-ext/manifest.json' })) {
        throw 'render-ext/manifest.json missing from the archive'
    }
    $count = $check.Entries.Count
} finally {
    $check.Dispose()
}

Remove-Item -Recurse -Force $stage
Write-Host "built: $zip ($count entries, all '/')"
Get-Item $zip | Select-Object Name, @{n='MB';e={[Math]::Round($_.Length/1MB,2)}}
