# render-ext: generate extension icons (16/32/48/128 PNG) with System.Drawing.
# Design: rounded dark slate square (#0d1117) + "</>" glyph in GitHub blue.
# Re-run any time to regenerate app/icons/.

Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\app\icons'
New-Item -ItemType Directory -Force $outDir | Out-Null

function New-Icon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::Transparent)

    # rounded-rect background
    $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 13, 17, 23))
    $r = [Math]::Max(2, [int]($size * 0.20))
    $d = $r * 2
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $gp.AddArc(0, 0, $d, $d, 180, 90)
    $gp.AddArc($size - $d - 1, 0, $d, $d, 270, 90)
    $gp.AddArc($size - $d - 1, $size - $d - 1, $d, $d, 0, 90)
    $gp.AddArc(0, $size - $d - 1, $d, $d, 90, 90)
    $gp.CloseFigure()
    $g.FillPath($bg, $gp)

    # "</>" glyph (plain "R" at 16px where "</>" would smear)
    $text = if ($size -le 16) { 'R' } else { '</>' }
    $fontSize = if ($size -le 16) { [int]($size * 0.62) } else { [int]($size * 0.40) }
    $font = New-Object System.Drawing.Font('Consolas', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 88, 166, 255))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, ($size * 0.02), $size, $size)
    $g.DrawString($text, $font, $fg, $rect, $sf)

    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "wrote $path"
}

foreach ($s in 16, 32, 48, 128) {
    New-Icon $s (Join-Path $outDir "icon$s.png")
}
