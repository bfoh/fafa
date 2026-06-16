<#
  Resize iPhone screenshots to the App Store Connect 6.7" portrait size
  (1290 x 2796), accepted for the required 6.7"/6.9" iPhone slot.

  Windows PowerShell only — uses built-in System.Drawing (no install).
  Scales each image to COVER the frame, then centre-crops to the exact size,
  so there is no stretching/distortion (a little edge may be trimmed).

  Usage:
    powershell -ExecutionPolicy Bypass -File scripts\resize-appstore-screenshots.ps1 -Folder "C:\path\to\screenshots"

  Output: <Folder>\appstore-screenshots\<name>.png  at 1290 x 2796.
#>
param(
  [Parameter(Mandatory = $true)][string]$Folder,
  [int]$W = 1290,
  [int]$H = 2796
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Folder)) { throw "Folder not found: $Folder" }
$out = Join-Path $Folder 'appstore-screenshots'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$files = Get-ChildItem -Path $Folder -File |
  Where-Object { $_.Extension -match '^\.(png|jpg|jpeg)$' }

foreach ($file in $files) {
  $src = [System.Drawing.Image]::FromFile($file.FullName)
  try {
    $scale = [Math]::Max($W / $src.Width, $H / $src.Height)
    $nw = [int][Math]::Ceiling($src.Width * $scale)
    $nh = [int][Math]::Ceiling($src.Height * $scale)

    # 24-bit RGB (NO alpha channel) — App Store Connect rejects screenshots that
    # contain transparency. Clear to opaque black so any uncovered edge is solid.
    $bmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Black)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    # Centre the oversized image; the canvas clips the overflow (centre-crop).
    $x = [int](($W - $nw) / 2)
    $y = [int](($H - $nh) / 2)
    $g.DrawImage($src, $x, $y, $nw, $nh)
    $g.Dispose()

    $dest = Join-Path $out ($file.BaseName + '.png')
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output ("OK  {0}  ({1} x {2})" -f $dest, $W, $H)
  }
  finally {
    $src.Dispose()
  }
}

Write-Output ""
Write-Output ("Done. Upload the files in {0} to App Store Connect (iPhone 6.7"").)" -f $out)
