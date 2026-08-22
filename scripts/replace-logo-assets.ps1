param(
  [Parameter(Mandatory = $true)]
  [string] $SourceLogo
)

if (!(Test-Path -LiteralPath $SourceLogo)) {
  throw "Source logo missing: $SourceLogo"
}

Add-Type -AssemblyName System.Drawing

function Save-Png {
  param(
    [Parameter(Mandatory = $true)] [string] $InputPath,
    [Parameter(Mandatory = $true)] [string] $OutputPath,
    [Parameter(Mandatory = $true)] [int] $Size
  )
  $srcImg = [System.Drawing.Image]::FromFile($InputPath)
  $bmp = $null
  $g = $null
  try {
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $ratio = [Math]::Min($Size / $srcImg.Width, $Size / $srcImg.Height)
    $w = [int]($srcImg.Width * $ratio)
    $h = [int]($srcImg.Height * $ratio)
    $x = [int](($Size - $w) / 2)
    $y = [int](($Size - $h) / 2)
    $g.DrawImage($srcImg, $x, $y, $w, $h)
    New-Item -ItemType Directory -Force -Path (Split-Path $OutputPath) | Out-Null
    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    if ($g) { $g.Dispose() }
    if ($bmp) { $bmp.Dispose() }
    $srcImg.Dispose()
  }
}

function Save-Ico {
  param(
    [Parameter(Mandatory = $true)] [string] $InputPath,
    [Parameter(Mandatory = $true)] [string] $OutputPath
  )
  $tmp = Join-Path $env:TEMP ("mana-logo-" + [guid]::NewGuid().ToString() + ".png")
  Save-Png -InputPath $InputPath -OutputPath $tmp -Size 256
  $bmp = [System.Drawing.Bitmap]::FromFile($tmp)
  try {
    $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
    $fs = [System.IO.File]::Create($OutputPath)
    try { $icon.Save($fs) } finally { $fs.Dispose(); $icon.Dispose() }
  } finally {
    $bmp.Dispose()
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
}

$web = 'C:\Users\telug\mana-poster-web-portal'
Save-Png $SourceLogo "$web\public\mana-poster-logo.png" 1024
Save-Png $SourceLogo "$web\src\app\icon.png" 1024
Save-Png $SourceLogo "$web\src\app\apple-icon.png" 180
Save-Png $SourceLogo "$web\src\app\apple-icon - Copy.png" 180

$app = 'C:\Users\telug\mana_poster_github_check'
Save-Png $SourceLogo "$app\assets\branding\mana_poster_logo.png" 1024
Save-Png $SourceLogo "$app\functions\assets\branding\mana_poster_logo.png" 1024
Save-Png $SourceLogo "$app\web\favicon.png" 192

$android = @{
  'mipmap-mdpi' = 48
  'mipmap-hdpi' = 72
  'mipmap-xhdpi' = 96
  'mipmap-xxhdpi' = 144
  'mipmap-xxxhdpi' = 192
}
foreach ($kv in $android.GetEnumerator()) {
  Save-Png $SourceLogo "$app\android\app\src\main\res\$($kv.Key)\ic_launcher.png" $kv.Value
}

$ios = "$app\ios\Runner\Assets.xcassets\AppIcon.appiconset"
$iosSizes = @{
  'Icon-App-20x20@1x.png' = 20
  'Icon-App-20x20@2x.png' = 40
  'Icon-App-20x20@3x.png' = 60
  'Icon-App-29x29@1x.png' = 29
  'Icon-App-29x29@2x.png' = 58
  'Icon-App-29x29@3x.png' = 87
  'Icon-App-40x40@1x.png' = 40
  'Icon-App-40x40@2x.png' = 80
  'Icon-App-40x40@3x.png' = 120
  'Icon-App-50x50@1x.png' = 50
  'Icon-App-50x50@2x.png' = 100
  'Icon-App-57x57@1x.png' = 57
  'Icon-App-57x57@2x.png' = 114
  'Icon-App-60x60@2x.png' = 120
  'Icon-App-60x60@3x.png' = 180
  'Icon-App-72x72@1x.png' = 72
  'Icon-App-72x72@2x.png' = 144
  'Icon-App-76x76@1x.png' = 76
  'Icon-App-76x76@2x.png' = 152
  'Icon-App-83.5x83.5@2x.png' = 167
  'Icon-App-1024x1024@1x.png' = 1024
}
foreach ($kv in $iosSizes.GetEnumerator()) {
  Save-Png $SourceLogo "$ios\$($kv.Key)" $kv.Value
}

$mac = "$app\macos\Runner\Assets.xcassets\AppIcon.appiconset"
$macSizes = @{
  'app_icon_16.png' = 16
  'app_icon_32.png' = 32
  'app_icon_64.png' = 64
  'app_icon_128.png' = 128
  'app_icon_256.png' = 256
  'app_icon_512.png' = 512
  'app_icon_1024.png' = 1024
}
foreach ($kv in $macSizes.GetEnumerator()) {
  Save-Png $SourceLogo "$mac\$($kv.Key)" $kv.Value
}
Save-Ico $SourceLogo "$app\windows\runner\resources\app_icon.ico"

$cms = 'C:\Users\telug\mana-poster-legal-cms'
Save-Png $SourceLogo "$cms\public\mana_poster_logo.png" 1024

Write-Output 'logo assets replaced'
