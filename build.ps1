# Packs the add-on into mute-whites.xpi (a zip with the files at its root).
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$xpi = Join-Path $here "mute-whites.xpi"
$zip = Join-Path $here "mute-whites.zip"
Remove-Item $xpi, $zip -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $here "manifest.json"), (Join-Path $here "background.js"), (Join-Path $here "icon.svg") -DestinationPath $zip
Rename-Item $zip $xpi
Write-Host "Built $xpi"
