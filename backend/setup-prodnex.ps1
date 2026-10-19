# +============================================================+
# | setup-prodnex.ps1 - first Prodnex deploy (VS Code)         |
# | Run in backend, after creating .env.prod:                  |
# |   .\setup-prodnex.ps1                                      |
# | Creates the prodnex database on the same PostgreSQL as     |
# | Infinity (DB_HOST of .env.prod), loads the local tables    |
# | and runs deploy.ps1.                                       |
# +============================================================+

$EnvFile  = ".env.prod"
$LOCAL_DB = "prodnex"   # local database copied to the server

function Step($label, [scriptblock]$cmd) {
  Write-Host ""
  Write-Host "[$label]" -ForegroundColor Cyan
  & $cmd
  if ($LASTEXITCODE -ne 0) { throw "FAILED: $label" }
}

function Find-PgTool($name) {
  $cmd = (Get-Command $name -ErrorAction SilentlyContinue).Source
  if ($cmd) { return $cmd }
  $found = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$name.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
  if (-not $found) { throw "$name not found. Install PostgreSQL or add its bin folder to PATH." }
  return $found
}

# ---------- Read .env.prod ----------
if (-not (Test-Path $EnvFile)) {
  throw "Create backend\.env.prod first: a copy of Infinity's .env with DEPLOY_SERVICE=prodnex, DB_NAME=prodnex and a new JWT_SECRET."
}
$cfg = @{}
Get-Content $EnvFile -Encoding UTF8 | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    $cfg[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
  }
}

if ($cfg["DEPLOY_SERVICE"] -ne "prodnex" -or $cfg["DB_NAME"] -ne "prodnex") {
  throw ".env.prod must have DEPLOY_SERVICE=prodnex and DB_NAME=prodnex (today: DEPLOY_SERVICE=$($cfg['DEPLOY_SERVICE']), DB_NAME=$($cfg['DB_NAME']))."
}

$DB_HOST = $cfg["DB_HOST"]
$DB_PORT = if ($cfg["DB_PORT"]) { $cfg["DB_PORT"] } else { "5432" }
$DB_USER = if ($cfg["DB_USER"]) { $cfg["DB_USER"] } else { "postgres" }
$DB_PASS = if ($cfg["DB_PASS"]) { $cfg["DB_PASS"] } else { $cfg["DB_PASSWORD"] }
if (-not $DB_HOST) { throw "DB_HOST is missing in .env.prod (it should be the same server Infinity uses)." }

Write-Host "Server   = ${DB_HOST}:$DB_PORT (user $DB_USER)"

$psql     = Find-PgTool "psql"
$createdb = Find-PgTool "createdb"
$pgDump   = Find-PgTool "pg_dump"

# psql against the server, with the password from .env.prod (only for this call)
function Remote([string[]]$a) {
  $env:PGPASSWORD = $DB_PASS
  try { & $psql -h $DB_HOST -p $DB_PORT -U $DB_USER @a } finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
}

# ---------- 1. Reach the server ----------
Remote @("-d", "postgres", "-tAc", "select version()")
if ($LASTEXITCODE -ne 0) {
  throw @"
This PC can't reach the database at ${DB_HOST}:$DB_PORT.
If DB_HOST is an internal IP (10.x, 172.16-31.x, 192.168.x) it only works inside Google Cloud.
Paste this message in the Prodnex thread and Claude will give you the commands to run on the VM.
"@
}

# ---------- 2. Create the prodnex database ----------
$exists = Remote @("-d", "postgres", "-tAc", "select 1 from pg_database where datname = 'prodnex'")
if ("$exists".Trim() -eq "1") {
  Write-Host ""
  Write-Host "[database] prodnex already exists on $DB_HOST, keeping it." -ForegroundColor Yellow
  $hasTables = Remote @("-d", "prodnex", "-tAc", "select count(*) from information_schema.tables where table_schema = 'public'")
  Write-Host "           tables in prodnex: $("$hasTables".Trim())"
} else {
  Step "create database prodnex" {
    $env:PGPASSWORD = $DB_PASS
    try { & $createdb -h $DB_HOST -p $DB_PORT -U $DB_USER prodnex } finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  }
}

# ---------- 3. Load the tables from the local database ----------
$load = Read-Host "Load the tables from your local '$LOCAL_DB' database into the server now? (y/n)"
if ($load -eq "y") {
  try {
    Write-Host "(pg_dump asks for the password of your LOCAL PostgreSQL)" -ForegroundColor Yellow
    Step "export local $LOCAL_DB" { & $pgDump -h localhost -U postgres --no-owner --no-privileges -f prodnex.sql $LOCAL_DB }
    Step "load into prodnex on $DB_HOST" { Remote @("-d", "prodnex", "-v", "ON_ERROR_STOP=1", "-q", "-f", "prodnex.sql") }
  } finally {
    # the dump has company data: remove it from the PC
    Remove-Item prodnex.sql -ErrorAction SilentlyContinue
  }
}

# ---------- 4. Deploy ----------
Write-Host ""
Write-Host "[deploy]" -ForegroundColor Cyan
.\deploy.ps1 -EnvFile $EnvFile
