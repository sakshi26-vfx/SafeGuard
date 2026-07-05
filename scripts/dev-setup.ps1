#!/usr/bin/env pwsh
# =============================================================================
# SafeGuard Vault - Automated Dev Setup Script
# Run from the project root: .\scripts\dev-setup.ps1
# =============================================================================

param(
  [switch]$SkipDeps,       # Skip npm install
  [switch]$ResetEnv,       # Overwrite .env.local from .env.local.example
  [switch]$OpenBrowser     # Open browser automatically after server starts
)

$ErrorActionPreference = 'Stop'
$FrontendDir = Join-Path (Join-Path $PSScriptRoot "..") "frontend"

function Write-Step {
  param([string]$Num, [string]$Title)
  Write-Host ""
  Write-Host "------------------------------------------" -ForegroundColor DarkGray
  Write-Host ('  STEP ' + $Num + ': ' + $Title) -ForegroundColor Cyan
  Write-Host "------------------------------------------" -ForegroundColor DarkGray
}

function Write-OK   { param([string]$Msg) Write-Host "  [OK]  $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host "  [WARN] $Msg" -ForegroundColor Yellow }
function Write-Err  { param([string]$Msg) Write-Host "  [ERROR] $Msg" -ForegroundColor Red }

# === STEP 1: Verify Node.js ===
Write-Step "1" "Verify Node.js and npm"
try {
  $nodeVersion = node --version
  $npmVersion  = npm --version
  Write-OK "Node $nodeVersion / npm $npmVersion"
} catch {
  Write-Err "Node.js is not installed or not in PATH. Install from https://nodejs.org"
  exit 1
}

# === STEP 2: Check .env.local ===
Write-Step "2" "Check .env.local configuration"
$envFile        = Join-Path $FrontendDir ".env.local"
$envExampleFile = Join-Path $FrontendDir ".env.local.example"

if (-not (Test-Path $envFile)) {
  if (Test-Path $envExampleFile) {
    Copy-Item $envExampleFile $envFile
    Write-Warn ".env.local was missing - copied from .env.local.example. Edit it before proceeding."
  } else {
    Write-Err ".env.local not found and no .env.local.example to copy from."
    exit 1
  }
} else {
  Write-OK ".env.local exists"
}

if ($ResetEnv -and (Test-Path $envExampleFile)) {
  Copy-Item $envExampleFile $envFile -Force
  Write-Warn ".env.local has been reset from .env.local.example."
}

# Validate critical env vars
$envContent = Get-Content $envFile -Raw
$required = @(
  "NEXT_PUBLIC_CONTRACT_ID",
  "NEXT_PUBLIC_STELLAR_NETWORK",
  "NEXT_PUBLIC_STELLAR_RPC",
  "NEXT_PUBLIC_TOKEN_ADDRESS"
)
$missing = @()
foreach ($key in $required) {
  if ($envContent -notmatch "^$key\s*=\s*.+") { $missing += $key }
}
if ($missing.Count -gt 0) {
  Write-Warn "The following required env vars are empty or missing in .env.local:"
  $missing | ForEach-Object { Write-Host "    - $_" -ForegroundColor Yellow }
  Write-Warn "Edit D:\SafeGuard.stellar\frontend\.env.local to fill them in."
} else {
  Write-OK "All required env vars are set"
}

# === STEP 3: Install dependencies ===
Write-Step "3" "Install npm dependencies"
if ($SkipDeps) {
  Write-Warn "Skipping npm install"
} else {
  $nodeModules = Join-Path $FrontendDir "node_modules"
  if (-not (Test-Path $nodeModules)) {
    Write-Host "  Running npm install..." -ForegroundColor Gray
    Push-Location $FrontendDir
    npm install --prefer-offline --loglevel=warn
    Pop-Location
    Write-OK "Dependencies installed"
  } else {
    Write-OK "node_modules already exists - skipping install"
  }
}

# === STEP 4: Kill any existing dev server ===
Write-Step "4" "Clear port 3000 (kill existing dev servers)"
$port3000 = netstat -ano | Select-String ":3000\s" | Select-String "LISTENING"
if ($port3000) {
  $pidMatch = $port3000 -replace ".*\s+(\d+)\s*$", '$1'
  $pid3000  = ($pidMatch | Select-Object -First 1).Trim()
  if ($pid3000 -match "^\d+$") {
    try {
      taskkill /PID $pid3000 /F | Out-Null
      Write-OK "Killed process on port 3000 (PID $pid3000)"
    } catch {
      Write-Warn "Could not kill PID $pid3000 - you may need to close it manually"
    }
  }
} else {
  Write-OK "Port 3000 is free"
}

# === STEP 5: Print localStorage clear instructions ===
Write-Step "5" "Clear stale browser localStorage (manual action required)"
Write-Host ""
Write-Host "  After the dev server starts, open your browser console (F12 -> Console)" -ForegroundColor White
Write-Host "  and paste this command to remove stale passkey data:" -ForegroundColor White
Write-Host ""
Write-Host "  localStorage.removeItem('sg_credential_id');" -ForegroundColor Magenta
Write-Host "  localStorage.removeItem('sg_passkey_pubkey');" -ForegroundColor Magenta
Write-Host ""
Write-Host "  This ensures no stale credential diverges from the on-chain key." -ForegroundColor DarkGray

# === STEP 6: Start dev server ===
Write-Step "6" "Start Next.js dev server"
Write-Host ""
Write-Host "  Starting: npm run dev  (in $FrontendDir)" -ForegroundColor Gray
Write-Host "  The dev server will be available at http://localhost:3000" -ForegroundColor Gray
Write-Host "  Dashboard:  http://localhost:3000/dashboard" -ForegroundColor Gray
Write-Host ""
Write-Host "  Press Ctrl+C to stop the server." -ForegroundColor DarkGray
Write-Host ""

if ($OpenBrowser) {
  Start-Sleep -Seconds 3
  Start-Process "http://localhost:3000/dashboard"
  Write-OK "Opened browser at http://localhost:3000/dashboard"
}

Push-Location $FrontendDir
npm run dev
Pop-Location
