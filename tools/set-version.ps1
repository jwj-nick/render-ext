# render-ext: set the extension version, keeping the displayed name in sync.
#
# The chrome://extensions card shows the manifest "name", so we embed the
# version there ("Raw File Viewer v0.4.2") to make it obvious which build is
# loaded. This script is the ONLY place that should edit those two fields.
#
#   .\tools\set-version.ps1 0.4.2
#
# Then: .\tools\make-zip.ps1   (make-zip verifies name and version agree)

param(
    [Parameter(Mandatory = $true)][string]$Version
)

$ErrorActionPreference = 'Stop'

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Version must look like 1.2.3 (got '$Version')"
}

$BaseName = 'Raw File Viewer'
$manifest = Join-Path (Split-Path $PSScriptRoot -Parent) 'app\manifest.json'

# Read as UTF-8 explicitly: PS 5.1's Get-Content guesses the codepage and would
# mangle non-ASCII characters in the manifest on write-back.
$txt = [System.IO.File]::ReadAllText($manifest, [System.Text.Encoding]::UTF8)
$txt = $txt -replace '("version"\s*:\s*")[^"]*(")', "`${1}$Version`${2}"
$txt = $txt -replace '("name"\s*:\s*")[^"]*(")', "`${1}$BaseName v$Version`${2}"

[System.IO.File]::WriteAllText($manifest, $txt, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "manifest: name = '$BaseName v$Version', version = $Version"
