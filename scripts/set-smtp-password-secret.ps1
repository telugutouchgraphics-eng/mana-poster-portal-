# Saves Brevo SMTP password to Google Cloud Secret Manager as SMTP_PASSWORD.
# Usage:
#   .\scripts\set-smtp-password-secret.ps1
#   .\scripts\set-smtp-password-secret.ps1 -SecretFile C:\temp\smtp-key.txt
#
# Tip: If paste fails in PowerShell 5.1, right-click the terminal title bar -> Edit -> Paste,
#      or save the key in a one-line .txt file and use -SecretFile.

param(
  [string]$SecretFile
)

$ErrorActionPreference = "Stop"
$Project = "mana-poster-ap"
# Windows PowerShell 5.1: use gcloud.cmd so piping stdin to secrets works reliably.
$Gcloud = "gcloud.cmd"
$secret = $null

if ($SecretFile) {
  if (-not (Test-Path -LiteralPath $SecretFile)) {
    throw "File not found: $SecretFile"
  }
  $secret = (Get-Content -LiteralPath $SecretFile -Raw).Trim()
  Write-Host "Read secret from file (length: $($secret.Length) chars)." -ForegroundColor Cyan
} else {
  Write-Host ""
  Write-Host "TIP: If Ctrl+V does not paste, use Right-click -> Paste in this window." -ForegroundColor Yellow
  Write-Host ""
  for ($i = 1; $i -le 5; $i++) {
    Write-Host "Paste your Brevo SMTP key (xsmtpsib-...), then press Enter (try $i of 5):"
    $secret = Read-Host
    $secret = $secret.Trim()
    if (-not [string]::IsNullOrWhiteSpace($secret)) { break }
    Write-Host "No text received. Try again or use: -SecretFile path\to\key.txt" -ForegroundColor Yellow
    Write-Host ""
  }
}

if ([string]::IsNullOrWhiteSpace($secret)) {
  throw "Empty input - cancelled. Create a one-line text file with only your SMTP key, then run: .\scripts\set-smtp-password-secret.ps1 -SecretFile C:\path\to\that.txt"
}

& $Gcloud secrets describe SMTP_PASSWORD --project=$Project 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Updating existing secret SMTP_PASSWORD (new version)..." -ForegroundColor Yellow
  $secret | & $Gcloud secrets versions add SMTP_PASSWORD --data-file=- --project=$Project
} else {
  Write-Host "Creating secret SMTP_PASSWORD..." -ForegroundColor Yellow
  $secret | & $Gcloud secrets create SMTP_PASSWORD `
    --data-file=- `
    --project=$Project `
    --replication-policy="automatic"
}

Write-Host ""
Write-Host "Done. Firebase Console: App Hosting, your backend, Environment / secrets - confirm SMTP_PASSWORD." -ForegroundColor Green
