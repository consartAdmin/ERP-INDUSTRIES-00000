# +============================================================+
# | copy-schema-from-infinity.ps1                              |
# | Copies the table structure of an Infinity database into    |
# | prodnex (same server, DB_HOST of .env.prod), plus the data |
# | of the login/menu tables so you can sign in.               |
# |   .\copy-schema-from-infinity.ps1                          |
# |   .\copy-schema-from-infinity.ps1 -AllData   (copy all)    |
# | The PCP / production tables are created by Prodnex itself  |
# | on first use (CREATE TABLE IF NOT EXISTS).                 |
# +============================================================+

param(
  [string]$Source = "erp-infinity-00001",
  [string]$EnvFile = ".env.prod",
  [switch]$AllData
)

$TARGET = "prodnex"

function Find-PgTool($name) {
  # newest installed PostgreSQL first: pg_dump must be >= the server version
  $found = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$name.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Directory.Parent.Name -replace '\D', '') } -Descending |
    Select-Object -First 1 -ExpandProperty FullName
  if ($found) { return $found }
  $cmd = (Get-Command $name -ErrorAction SilentlyContinue).Source
  if ($cmd) { return $cmd }
  throw "$name not found. Install PostgreSQL or add its bin folder to PATH."
}

# ---------- Read .env.prod ----------
if (-not (Test-Path $EnvFile)) { throw "$EnvFile not found. Run this in backend." }
$cfg = @{}
Get-Content $EnvFile -Encoding UTF8 | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    $cfg[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
  }
}
$DB_HOST = $cfg["DB_HOST"]
$DB_PORT = if ($cfg["DB_PORT"]) { $cfg["DB_PORT"] } else { "5432" }
$DB_USER = if ($cfg["DB_USER"]) { $cfg["DB_USER"] } else { "postgres" }
$DB_PASS = if ($cfg["DB_PASS"]) { $cfg["DB_PASS"] } else { $cfg["DB_PASSWORD"] }
if (-not $DB_HOST) { throw "DB_HOST is missing in $EnvFile." }

$psql   = Find-PgTool "psql"
$pgDump = Find-PgTool "pg_dump"
$pgVer = [int]((& $pgDump --version) -replace '^\D*(\d+).*$', '$1')
if ($pgVer -lt 17) { throw "pg_dump $pgVer is too old for this server (PostgreSQL 17). Install PostgreSQL 17 or newer on the PC." }
Write-Host "pg_dump  = $pgDump"
Write-Host "Server   = ${DB_HOST}:$DB_PORT"
Write-Host "Copy     = $Source  ->  $TARGET"

$env:PGPASSWORD = $DB_PASS
$tmp = Join-Path $env:TEMP "prodnex-copy-$([Guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $tmp | Out-Null

try {
  # ---------- Safety: prodnex must be empty ----------
  $count = & $psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $TARGET -tAc "select count(*) from pg_tables where schemaname = 'public'"
  if ($LASTEXITCODE -ne 0) { throw "Could not open database $TARGET on $DB_HOST." }
  if ([int]"$count".Trim() -gt 0) {
    throw "$TARGET already has $("$count".Trim()) tables. Nothing was changed. Ask Claude before copying over existing tables."
  }

  # ---------- 1. Structure (all tables, no data) ----------
  Write-Host ""
  Write-Host "[1/2] Copying table structure from $Source..." -ForegroundColor Cyan
  $schemaFile = Join-Path $tmp "schema.sql"
  & $pgDump -h $DB_HOST -p $DB_PORT -U $DB_USER --schema-only --no-owner --no-privileges -f $schemaFile $Source
  if ($LASTEXITCODE -ne 0) { throw "pg_dump of $Source structure failed." }
  & $psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $TARGET -v ON_ERROR_STOP=1 -q -f $schemaFile
  if ($LASTEXITCODE -ne 0) { throw "Loading the structure into $TARGET failed." }

  # ---------- 2. Data ----------
  if ($AllData) {
    $tables = @()
    Write-Host ""
    Write-Host "[2/2] Copying ALL data from $Source..." -ForegroundColor Cyan
  } else {
    $tables = @(& $psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $Source -tAc @"
select tablename from pg_tables
where schemaname = 'public'
  and (tablename ilike 'user%' or tablename ilike '%modul%' or tablename ilike '%menu%'
       or tablename ilike '%profile%' or tablename ilike '%perfil%' or tablename ilike '%permiss%'
       or tablename ilike '%companies%' or tablename ilike '%empresa%')
order by 1
"@ | Where-Object { $_ })
    Write-Host ""
    Write-Host "[2/2] Data of the login / menu / company tables:" -ForegroundColor Cyan
    $tables | ForEach-Object { Write-Host "      $_" }
    if ($tables.Count -eq 0) { Write-Host "No login/menu tables found. Only the structure was copied."; return }
    $ok = Read-Host "Copy the data of these tables? (y/n)"
    if ($ok -ne "y") { Write-Host "Only the structure was copied."; return }
  }

  $dataFile = Join-Path $tmp "data.sql"
  # --disable-triggers: users may point to rows (employees, etc.) that are not copied
  $dumpArgs = @("-h", $DB_HOST, "-p", $DB_PORT, "-U", $DB_USER, "--data-only", "--disable-triggers", "--no-owner", "--no-privileges", "-f", $dataFile)
  if (-not $AllData) {
    # table list in a filter file: keeps names like "userModules" exact (no shell quoting)
    $filterFile = Join-Path $tmp "tables.txt"
    $lines = $tables | ForEach-Object { 'include table public."' + $_ + '"' }
    [System.IO.File]::WriteAllLines($filterFile, [string[]]$lines, (New-Object System.Text.UTF8Encoding($false)))
    $dumpArgs += "--filter=$filterFile"
  }
  & $pgDump @dumpArgs $Source
  if ($LASTEXITCODE -ne 0) { throw "pg_dump of $Source data failed." }
  & $psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $TARGET -v ON_ERROR_STOP=1 -q -f $dataFile
  if ($LASTEXITCODE -ne 0) { throw "Loading the data into $TARGET failed." }

  Write-Host ""
  Write-Host "Done. $TARGET now has the structure of $Source." -ForegroundColor Green
  Write-Host "Next: .\deploy.ps1 -EnvFile .env.prod"
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  # the dumps may contain company data: remove them from the PC
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
