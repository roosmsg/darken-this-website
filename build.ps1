# Packs the add-on into darken-this-website.xpi (a zip with the files at its root).
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$xpi = Join-Path $here "darken-this-website.xpi"
$zip = Join-Path $here "darken-this-website.zip"
Remove-Item $xpi, $zip -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $here "manifest.json"), (Join-Path $here "background.js"), (Join-Path $here "icon.svg") -DestinationPath $zip
Rename-Item $zip $xpi
Write-Host "Built $xpi"
