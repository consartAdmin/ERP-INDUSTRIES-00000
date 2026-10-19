#requires -Version 5.1
<#
.SYNOPSIS
  Conecta o serviço Cloud Run (e a máquina local) aos buckets do GCS definidos no .env.

.DESCRIPTION
  Lê o .env e, para cada bucket encontrado (UPLOAD_BUCKET, GCS_BUCKET, GCS_BUCKET_MOBILIZED,
  BUDGETS_GCS_BUCKET, NFE_A1_GCS_BUCKET, NFE_CERT_BUCKET):
    1. Confere se o bucket existe (cria com -CreateMissing, só buckets da aplicação).
    2. Dá à service account do Cloud Run:
         - roles/storage.objectAdmin  nos buckets da aplicação (upload, anexos, imagens, PDFs)
         - roles/storage.objectViewer nos buckets do certificado NF-e (só leitura)
    3. Dá à service account permissão de assinar URLs (Signed URLs) sem arquivo de chave
       (roles/iam.serviceAccountTokenCreator nela mesma).
  Opcional:
    -UpdateService   envia só as variáveis de bucket do .env para o serviço Cloud Run
                     e remove GOOGLE_APPLICATION_CREDENTIALS de lá (caminho do Windows
                     não existe no container e quebra o `new Storage()`).
    -SetupLocal      prepara esta máquina para acessar o bucket como a SA, sem arquivo de chave
                     (a organização bloqueia chaves): dá ao DEPLOY_ACCOUNT permissão de
                     personificar a SA, abre o login do gcloud no navegador
                     (application-default --impersonate-service-account) e aponta
                     GOOGLE_APPLICATION_CREDENTIALS do .env para a credencial gerada.
    -PublicRead      libera leitura pública (allUsers) nos buckets da aplicação, para links
                     https://storage.googleapis.com/... funcionarem sem assinatura.
    -DryRun          só mostra os comandos gcloud, não altera nada.

  Usa DEPLOY_ACCOUNT, DEPLOY_PROJECT, DEPLOY_REGION e DEPLOY_SERVICE do .env, como o deploy.ps1.
  Nenhum valor secreto é impresso.

.EXAMPLE
  .\deploy-bucket.ps1 -DryRun                    # confere o que seria feito
.EXAMPLE
  .\deploy-bucket.ps1                            # permissões nos buckets
.EXAMPLE
  .\deploy-bucket.ps1 -UpdateService             # permissões + variáveis de bucket no Cloud Run
.EXAMPLE
  .\deploy-bucket.ps1 -SetupLocal                # acesso ao bucket no backend local (abre o navegador)
.EXAMPLE
  .\deploy-bucket.ps1 -EnvFile .env.00001 -UpdateService -CreateMissing
.NOTES
  Execute dentro de backend. Requer gcloud logado (gcloud auth login) com permissão de
  Storage Admin nos buckets e de IAM na service account.
#>

[CmdletBinding()]
param(
  [string]$EnvFile = "",
  [string]$Project = "",
  [string]$Service = "",
  [string]$Region = "",
  [string]$ServiceAccount = "",
  [switch]$UpdateService,
  [switch]$CreateMissing,
  [Alias("CreateLocalKey")]
  [switch]$SetupLocal,
  [switch]$PublicRead,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Variáveis do PowerShell ignoram maiúsculas: guarda os parâmetros antes de usar $PROJECT etc.
$ArgProject = $Project
$ArgService = $Service
$ArgRegion  = $Region
$ArgSa      = $ServiceAccount

# Chaves do .env que apontam para buckets
$APP_BUCKET_KEYS    = @("UPLOAD_BUCKET", "GCS_BUCKET", "GCS_BUCKET_MOBILIZED", "BUDGETS_GCS_BUCKET")
$SECRET_BUCKET_KEYS = @("NFE_A1_GCS_BUCKET", "NFE_CERT_BUCKET")
# Chaves com "BUCKET" no nome que não são nome de bucket
$NOT_A_BUCKET_KEYS  = @("PDF_BUCKET_BUDGETS")

# Variáveis enviadas ao Cloud Run com -UpdateService
$BUCKET_ENV_PATTERN = '^(UPLOAD_BUCKET|GCS_.+|BUDGETS_GCS_.+|PDF_BUCKET_.+|NFE_A1_GCS_.+|NFE_CERT_BUCKET|NFE_CERT_OBJECT|GCP_PROJECT|GOOGLE_CLOUD_PROJECT)$'

function Resolve-DotEnvPath {
  if ($EnvFile) {
    if (-not (Test-Path -Path $EnvFile)) { throw "❌ Arquivo não encontrado: $EnvFile" }
    return (Resolve-Path $EnvFile).Path
  }
  foreach ($p in @(".env", "backend/.env", "../backend/.env")) {
    if (Test-Path -Path $p) { return (Resolve-Path $p).Path }
  }
  throw "❌ Arquivo .env não encontrado."
}

function ConvertTo-EnvValue([string]$value) {
  if ($null -eq $value) { return $null }
  $v = $value.Trim()
  if ($v.StartsWith('"') -or $v.StartsWith("'")) {
    $quote = $v.Substring(0, 1)
    $close = $v.IndexOf($quote, 1)
    if ($close -gt 0) { return $v.Substring(1, $close - 1) }
  }
  $hashPos = $v.IndexOf(" #")
  if ($hashPos -ge 0) { $v = $v.Substring(0, $hashPos).Trim() }
  return $v
}

function Import-DotEnv($path) {
  $map = [ordered]@{}
  Get-Content $path -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $k = $line.Substring(0, $eq).Trim()
    if ($k -notmatch '^[_A-Za-z][_A-Za-z0-9]*$') { return }
    $map[$k] = ConvertTo-EnvValue ($line.Substring($eq + 1))
  }
  return $map
}

function Invoke-GcloudQuiet {
  # Leitura: retorna stdout ou $null se o gcloud falhar (recurso inexistente é esperado)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $out = $(& gcloud @args 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $out) { return $null }
    return $out
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Invoke-GcloudRead {
  # Leitura com diagnóstico: @{ Ok; Out (stdout); Err (stderr) }
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $all = @(& gcloud @args 2>&1)
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prev
  }
  return @{
    Ok  = ($code -eq 0)
    Out = (($all | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }) -join "`n").Trim()
    Err = (($all | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] } | ForEach-Object { $_.ToString() }) -join "`n").Trim()
  }
}

$script:Failures = @()

function Invoke-Change([string]$label) {
  # Alteração: no -DryRun só mostra o comando; falha vira aviso e entra no resumo final
  if ($DryRun) {
    Write-Host "  [dry-run] gcloud $($args -join ' ')" -ForegroundColor DarkGray
    return $true
  }
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $out = @(& gcloud @args 2>&1)
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prev
  }
  if ($code -eq 0) {
    Write-Host "  ✔ $label" -ForegroundColor Green
    return $true
  }
  $err = ($out | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] } | ForEach-Object { $_.ToString() }) -join "`n"
  Write-Host "  ✖ $label`n$err" -ForegroundColor Red
  $script:Failures += $label
  return $false
}

function Test-BucketName([string]$name) {
  return $name -match '^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$'
}

# ── .env ────────────────────────────────────────────────────────
$DotEnvPath = Resolve-DotEnvPath
Write-Host "[INFO] Usando .env em: $DotEnvPath"
$ENVALL = Import-DotEnv $DotEnvPath

$PROJECT = if ($ArgProject) { $ArgProject } else { [string]$ENVALL["DEPLOY_PROJECT"] }
$SERVICE = if ($ArgService) { $ArgService } else { [string]$ENVALL["DEPLOY_SERVICE"] }
$REGION  = if ($ArgRegion)  { $ArgRegion }  else { [string]$ENVALL["DEPLOY_REGION"] }
$ACCOUNT = [string]$ENVALL["DEPLOY_ACCOUNT"]
if (-not $REGION) { $REGION = "us-central1" }

if (-not $PROJECT -or -not $SERVICE) {
  throw "❌ Informe DEPLOY_PROJECT e DEPLOY_SERVICE no .env (ou -Project / -Service)."
}

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "❌ gcloud não encontrado no PATH. Instale o Google Cloud SDK."
}

# A conta do DEPLOY_ACCOUNT precisa estar logada no gcloud desta máquina
$logged = Invoke-GcloudRead auth list "--format=value(account)"
$loggedAccounts = @($logged.Out -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($ACCOUNT -and -not ($loggedAccounts -contains $ACCOUNT)) {
  throw "❌ A conta $ACCOUNT (DEPLOY_ACCOUNT) não está logada no gcloud. Rode: gcloud auth login $ACCOUNT"
}
if (-not $ACCOUNT -and $loggedAccounts.Count -eq 0) {
  throw "❌ Nenhuma conta logada no gcloud. Rode: gcloud auth login"
}

# Conta e projeto do gcloud só para este processo (não altera o `gcloud config` global)
if ($ACCOUNT) { $env:CLOUDSDK_CORE_ACCOUNT = $ACCOUNT }
$env:CLOUDSDK_CORE_PROJECT = $PROJECT

# ── Buckets do .env ─────────────────────────────────────────────
# nome do bucket -> "app" | "secret" (se aparecer nos dois, vale "app")
$BUCKETS = [ordered]@{}
foreach ($k in $ENVALL.Keys) {
  if ($k -notmatch 'BUCKET' -or $NOT_A_BUCKET_KEYS -contains $k) { continue }
  $name = ([string]$ENVALL[$k]).Trim()
  if ($name.StartsWith("gs://")) { $name = $name.Substring(5).TrimEnd("/") }
  if (-not $name) { continue }
  if (-not (Test-BucketName $name)) {
    Write-Host "[BUCKET] $k não parece nome de bucket, ignorado." -ForegroundColor Yellow
    continue
  }
  $kind = if ($SECRET_BUCKET_KEYS -contains $k) { "secret" } else { "app" }
  if (-not ($APP_BUCKET_KEYS -contains $k) -and $kind -eq "app") {
    Write-Host "[BUCKET] $k tratado como bucket da aplicação." -ForegroundColor Yellow
  }
  if (-not $BUCKETS.Contains($name) -or $kind -eq "app") { $BUCKETS[$name] = $kind }
}

if ($BUCKETS.Count -eq 0) { throw "❌ Nenhum bucket encontrado no .env." }

# ── Serviço Cloud Run e service account ────────────────────────
$svc = Invoke-GcloudRead run services describe $SERVICE "--region=$REGION" "--project=$PROJECT" "--format=json"
$live = $null
if ($svc.Ok -and $svc.Out) {
  $live = $svc.Out | ConvertFrom-Json
} elseif ($svc.Err -notmatch 'Cannot find service|could not be found|NOT_FOUND') {
  throw "❌ Falha ao consultar o serviço $SERVICE em $PROJECT/$REGION (conta: $(if ($ACCOUNT) { $ACCOUNT } else { 'padrão do gcloud' })):`n$($svc.Err)"
}

$SA = $ArgSa
if (-not $SA -and $live) { $SA = [string]$live.spec.template.spec.serviceAccountName }
if (-not $SA) {
  # Sem serviceAccountName o Cloud Run usa a conta padrão do Compute Engine
  $pn = Invoke-GcloudRead projects describe $PROJECT "--format=value(projectNumber)"
  if (-not $pn.Ok -or -not $pn.Out) {
    throw "❌ Não consegui ler o número do projeto $PROJECT. Informe a SA com -ServiceAccount <email>.`n$($pn.Err)"
  }
  $SA = "$($pn.Out)-compute@developer.gserviceaccount.com"
}

Write-Host ""
Write-Host "[INFO] PROJECT = $PROJECT"
Write-Host "[INFO] REGION  = $REGION"
Write-Host "[INFO] SERVICE = $SERVICE $(if ($live) { '(existe)' } else { '(ainda não existe)' })"
Write-Host "[INFO] SA      = $SA"
if ($ACCOUNT) { Write-Host "[INFO] ACCOUNT = $ACCOUNT" }
if ($DryRun)  { Write-Host "[INFO] MODO    = DryRun (nada será alterado)" -ForegroundColor Yellow }

# Trava: o .env precisa ser do serviço destino (mesma regra do deploy.ps1)
$envDbName = [string]$ENVALL["DB_NAME"]
if ($live -and $envDbName) {
  $liveDb = @($live.spec.template.spec.containers[0].env) | Where-Object { $_.name -eq "DB_NAME" } | Select-Object -First 1
  if ($liveDb -and $liveDb.value -and [string]$liveDb.value -ne $envDbName) {
    throw "❌ TRAVA: $SERVICE usa DB_NAME=$($liveDb.value), mas o arquivo tem DB_NAME=$envDbName. Arquivo de outro cliente? Use -EnvFile correto."
  }
}

# ── APIs ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[APIs] storage + iamcredentials (Signed URLs)..."
Invoke-Change "APIs habilitadas" services enable storage.googleapis.com iamcredentials.googleapis.com --project $PROJECT | Out-Null

# ── Buckets: existência + permissões ───────────────────────────
foreach ($b in $BUCKETS.Keys) {
  $kind = $BUCKETS[$b]
  Write-Host ""
  Write-Host "[BUCKET] gs://$b ($kind)"

  $exists = Invoke-GcloudQuiet storage buckets describe "gs://$b" "--format=value(name)"
  if (-not $exists) {
    if ($kind -eq "app" -and $CreateMissing) {
      $ok = Invoke-Change "bucket criado em $REGION" storage buckets create "gs://$b" --project $PROJECT --location $REGION --uniform-bucket-level-access
      if (-not $ok) { continue }
    } else {
      Write-Host "  ✖ Bucket não existe ou a conta logada não enxerga ele. $(if ($kind -eq 'app') { 'Use -CreateMissing para criar.' } else { 'Confira o projeto do certificado.' })" -ForegroundColor Red
      $script:Failures += "gs://$b inacessível"
      continue
    }
  }

  $role = if ($kind -eq "secret") { "roles/storage.objectViewer" } else { "roles/storage.objectAdmin" }
  Invoke-Change "$role para a SA" storage buckets add-iam-policy-binding "gs://$b" "--member=serviceAccount:$SA" "--role=$role" "--format=none" | Out-Null

  if ($PublicRead -and $kind -eq "app") {
    Invoke-Change "leitura pública (allUsers)" storage buckets add-iam-policy-binding "gs://$b" "--member=allUsers" "--role=roles/storage.objectViewer" "--format=none" | Out-Null
  }
}

# ── Signed URLs sem arquivo de chave (Cloud Run) ───────────────
Write-Host ""
Write-Host "[IAM] SA pode assinar URLs (serviceAccountTokenCreator nela mesma)..."
Invoke-Change "tokenCreator na SA" iam service-accounts add-iam-policy-binding $SA "--member=serviceAccount:$SA" "--role=roles/iam.serviceAccountTokenCreator" --project $PROJECT "--format=none" | Out-Null

# ── Variáveis de bucket no Cloud Run ───────────────────────────
if ($UpdateService) {
  Write-Host ""
  Write-Host "[CLOUD RUN] Atualizando variáveis de bucket em $SERVICE..."
  if (-not $live) {
    Write-Host "  ✖ Serviço ainda não existe: rode o deploy.ps1 primeiro." -ForegroundColor Red
    $script:Failures += "Cloud Run sem serviço"
  } else {
    $liveEnv = @($live.spec.template.spec.containers[0].env)
    $fromSecrets = @($liveEnv | Where-Object { $_.valueFrom } | ForEach-Object { $_.name })

    $pairs = @()
    $names = @()
    foreach ($k in $ENVALL.Keys) {
      if ($k -notmatch $BUCKET_ENV_PATTERN) { continue }
      if ($fromSecrets -contains $k) {
        Write-Host "  [SECRETS] $k vem do Secret Manager, mantido." -ForegroundColor Yellow
        continue
      }
      $pairs += "$k=$($ENVALL[$k])"
      $names += $k
    }

    if ($pairs.Count -gt 0) {
      # "^~^" troca o separador do gcloud (padrão é vírgula) para "~"
      $cmd = @("run", "services", "update", $SERVICE, "--region", $REGION, "--project", $PROJECT,
               "--update-env-vars", ("^~^" + ($pairs -join "~")))
      if ($liveEnv | Where-Object { $_.name -eq "GOOGLE_APPLICATION_CREDENTIALS" }) {
        $cmd += @("--remove-env-vars", "GOOGLE_APPLICATION_CREDENTIALS")
        Write-Host "  GOOGLE_APPLICATION_CREDENTIALS será removida do serviço (no Cloud Run vale a SA)."
      }
      Write-Host "  Variáveis: $($names -join ', ')"
      Invoke-Change "nova revisão com variáveis de bucket" @cmd | Out-Null
    }
  }
}

# ── Credencial local ───────────────────────────────────────────
Write-Host ""
$localCred = [string]$ENVALL["GOOGLE_APPLICATION_CREDENTIALS"]
$gcloudDir = if ($env:CLOUDSDK_CONFIG) { $env:CLOUDSDK_CONFIG } else { Join-Path $env:APPDATA "gcloud" }
$adcPath = Join-Path $gcloudDir "application_default_credentials.json"

if ($SetupLocal) {
  Write-Host "[LOCAL] Configurando acesso local como $SA (sem arquivo de chave)..."
  $me = if ($ACCOUNT) { $ACCOUNT } else { @($loggedAccounts)[0] }
  $memberType = if ($me -like "*.gserviceaccount.com") { "serviceAccount" } else { "user" }
  $ok = Invoke-Change "$me pode personificar a SA" iam service-accounts add-iam-policy-binding $SA "--member=${memberType}:$me" "--role=roles/iam.serviceAccountTokenCreator" --project $PROJECT "--format=none"

  if ($ok) {
    if ($DryRun) {
      Write-Host "  [dry-run] gcloud auth application-default login --impersonate-service-account=$SA" -ForegroundColor DarkGray
    } else {
      Write-Host "  Abrindo o navegador: entre com $me e autorize."
      $prev = $ErrorActionPreference
      $ErrorActionPreference = "Continue"
      try {
        & gcloud auth application-default login "--impersonate-service-account=$SA"
        $code = $LASTEXITCODE
      } finally {
        $ErrorActionPreference = $prev
      }
      if ($code -ne 0 -or -not (Test-Path $adcPath)) {
        Write-Host "  ✖ login application-default não concluído" -ForegroundColor Red
        $script:Failures += "login local (application-default)"
        $ok = $false
      } else {
        Write-Host "  ✔ credencial local criada: $adcPath" -ForegroundColor Green
      }
    }
  }

  if ($ok) {
    # Aponta o .env para a credencial do gcloud (o loadEnv.js faz ela prevalecer sobre a variável global do Windows)
    $newValue = $adcPath.Replace("\", "/")
    $line = "GOOGLE_APPLICATION_CREDENTIALS=$newValue"
    if ($DryRun) {
      Write-Host "  [dry-run] .env: $line" -ForegroundColor DarkGray
    } else {
      $raw = [System.IO.File]::ReadAllText($DotEnvPath)
      $nl = if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" }
      $rx = '(?m)^[ \t]*GOOGLE_APPLICATION_CREDENTIALS[ \t]*=.*?(?=\r?$)'
      if ([regex]::IsMatch($raw, $rx)) {
        $raw = [regex]::Replace($raw, $rx, { param($m) $line })
      } else {
        if ($raw.Length -gt 0 -and -not $raw.EndsWith("`n")) { $raw += $nl }
        $raw += $line + $nl
      }
      [System.IO.File]::WriteAllText($DotEnvPath, $raw, (New-Object System.Text.UTF8Encoding($false)))
      Write-Host "  ✔ .env atualizado: $line" -ForegroundColor Green
    }
  }
} elseif (-not $localCred) {
  Write-Host "[LOCAL] GOOGLE_APPLICATION_CREDENTIALS vazio no .env: o backend local usa a variável global do Windows." -ForegroundColor Yellow
  Write-Host "        Rode com -SetupLocal para acessar o bucket localmente."
} elseif ((Test-Path -Path $localCred) -and (Get-Item $localCred).Length -gt 0) {
  Write-Host "[LOCAL] Credencial local encontrada (GOOGLE_APPLICATION_CREDENTIALS)." -ForegroundColor Green
} else {
  Write-Host "[LOCAL] ⚠ O arquivo de GOOGLE_APPLICATION_CREDENTIALS não existe ou está vazio: o backend local não acessa o bucket." -ForegroundColor Yellow
  Write-Host "        Rode com -SetupLocal (login no navegador, sem arquivo de chave)."
}

# ── Resumo ─────────────────────────────────────────────────────
Write-Host ""
if ($script:Failures.Count -gt 0) {
  Write-Host "⚠ Concluído com $($script:Failures.Count) pendência(s):" -ForegroundColor Yellow
  $script:Failures | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
  exit 1
}
Write-Host "✅ Buckets conectados: $($BUCKETS.Keys -join ', ')"
