#requires -Version 5.1
<#
.SYNOPSIS
  Deploy rápido de arquivos ou pastas do backend no Google Cloud Run.

.EXAMPLE
  .\deploy-file.ps1 -Path "public\accountsReceivable"

.EXAMPLE
  .\deploy-file.ps1 -Path @(
    "public\accountsReceivable\accountsReceivable.html",
    "public\accountsReceivable\js\accountsReceivable.render.js"
  )

.NOTES
  Execute dentro de backend. O script adiciona ou substitui arquivos, mas não
  remove da imagem arquivos apagados localmente. Para exclusões, dependências,
  Dockerfile ou package*.json, use o deploy.ps1 completo.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateNotNullOrEmpty()]
    [string[]]$Path,
    [string]$EnvFile = ".env",
    [string]$Project = "",
    [string]$Region = "",
    [string]$Service = "",
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "======================================================================" -ForegroundColor Cyan
}

function Read-DeploySettings([string]$FilePath) {
    $map = @{}
    if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) { return $map }

    foreach ($rawLine in Get-Content -LiteralPath $FilePath -Encoding UTF8) {
        $line = $rawLine.Trim()
        if (-not $line -or $line.StartsWith("#")) { continue }
        $index = $line.IndexOf("=")
        if ($index -lt 1) { continue }

        $name = $line.Substring(0, $index).Trim()
        $value = $line.Substring($index + 1).Trim()
        if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { continue }

        if ($value.Length -ge 2) {
            if (
                ($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'"))
            ) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }
        $map[$name] = $value
    }
    return $map
}

function Resolve-Setting(
    [hashtable]$Map,
    [string]$Explicit,
    [string]$Name,
    [string]$Default
) {
    if (-not [string]::IsNullOrWhiteSpace($Explicit)) { return $Explicit }
    if ($Map.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace([string]$Map[$Name])) {
        return [string]$Map[$Name]
    }
    return $Default
}

$gcloudCommand = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
$gcloudExe = ""

if ($gcloudCommand) {
    $gcloudExe = $gcloudCommand.Source
}
elseif ($env:LOCALAPPDATA) {
    $known = Join-Path $env:LOCALAPPDATA "Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
    if (Test-Path -LiteralPath $known -PathType Leaf) {
        $gcloudExe = $known
    }
}

# Linux/macOS (ex.: GitHub Actions): gcloud sem .cmd
if ([string]::IsNullOrWhiteSpace($gcloudExe)) {
    $gcloudCommand = Get-Command gcloud -ErrorAction SilentlyContinue
    if ($gcloudCommand) { $gcloudExe = $gcloudCommand.Source }
}

if ([string]::IsNullOrWhiteSpace($gcloudExe)) {
    throw "gcloud.cmd não encontrado. Verifique a instalação do Google Cloud SDK."
}

function Invoke-GCloud {
    param([string[]]$Arguments, [switch]$Capture)

    Write-Host (">> gcloud " + ($Arguments -join " ")) -ForegroundColor DarkGray
    if ($DryRun) {
        if ($Capture) { return "" }
        return
    }

    if ($Capture) {
        $result = & $gcloudExe @Arguments 2>&1
        $code = $LASTEXITCODE
        if ($code -ne 0) {
            throw "Falha no gcloud (exit code $code): $($result | Out-String)"
        }
        return (($result | Out-String).Trim())
    }

    & $gcloudExe @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao executar gcloud $($Arguments -join ' ') (exit code $LASTEXITCODE)."
    }
}

Write-Step "PRODNEX ERP - DEPLOY RÁPIDO DE ARQUIVOS"

$backend = [System.IO.Path]::GetFullPath((Get-Location).Path)
if (-not (Test-Path -LiteralPath (Join-Path $backend "package.json") -PathType Leaf)) {
    throw "Execute este script dentro da pasta backend."
}

$separator = [System.IO.Path]::DirectorySeparatorChar
$backendPrefix = $backend.TrimEnd($separator) + $separator
$settings = Read-DeploySettings (Join-Path $backend $EnvFile)
# Sem padrão para projeto/serviço: um palpite errado publicaria no cliente errado
$Project = Resolve-Setting $settings $Project "DEPLOY_PROJECT" ""
$Region  = Resolve-Setting $settings $Region  "DEPLOY_REGION"  "us-central1"
$Service = Resolve-Setting $settings $Service "DEPLOY_SERVICE" ""
if ([string]::IsNullOrWhiteSpace($Project) -or [string]::IsNullOrWhiteSpace($Service)) {
    throw "Informe DEPLOY_PROJECT e DEPLOY_SERVICE no $EnvFile (ou -Project/-Service)."
}

# Conta do gcloud usada neste deploy (vale só para este processo do PowerShell)
$Account = Resolve-Setting $settings "" "DEPLOY_ACCOUNT" ""
if (-not [string]::IsNullOrWhiteSpace($Account)) {
    $env:CLOUDSDK_CORE_ACCOUNT = $Account
    Write-Host "Conta   : $Account"
}

Write-Host "Backend : $backend"
Write-Host "Projeto : $Project"
Write-Host "Região  : $Region"
Write-Host "Serviço : $Service"

$items = New-Object System.Collections.Generic.List[object]
$unique = @{}

foreach ($requested in $Path) {
    if ([string]::IsNullOrWhiteSpace($requested)) { throw "Caminho vazio." }

    if ([System.IO.Path]::IsPathRooted($requested)) {
        $source = [System.IO.Path]::GetFullPath($requested)
    } else {
        $source = [System.IO.Path]::GetFullPath((Join-Path $backend $requested))
    }

    if (-not $source.StartsWith($backendPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "O caminho deve estar dentro de backend: $requested"
    }
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Arquivo ou pasta não encontrado: $requested"
    }

    $relative = $source.Substring($backendPrefix.Length)
    $unixPath = $relative.Replace("\", "/")
    if (
        $unixPath -match '(^|/)\.env($|\.)' -or
        $unixPath -match '(^|/)node_modules(/|$)' -or
        $unixPath -match '(^|/)\.git(/|$)'
    ) {
        throw "Caminho protegido: $relative"
    }

    $key = $unixPath.ToLowerInvariant()
    if (-not $unique.ContainsKey($key)) {
        $unique[$key] = $true
        $items.Add([PSCustomObject]@{
            Source = $source
            Relative = $relative
            IsDirectory = (Test-Path -LiteralPath $source -PathType Container)
        })
    }
}

Write-Step "Obtendo a imagem ativa"
$currentImage = Invoke-GCloud -Capture -Arguments @(
    "run", "services", "describe", $Service,
    "--region=$Region",
    "--project=$Project",
    "--format=value(spec.template.spec.containers[0].image)"
)

if ($DryRun -and [string]::IsNullOrWhiteSpace($currentImage)) {
    $currentImage = "$Region-docker.pkg.dev/$Project/cloud-run-source-deploy/" + $Service + ":CURRENT"
}
if ([string]::IsNullOrWhiteSpace($currentImage)) {
    throw "Não foi possível localizar a imagem ativa do serviço."
}

$repository = $currentImage
$digestAt = $repository.IndexOf("@sha256:")
if ($digestAt -ge 0) {
    $repository = $repository.Substring(0, $digestAt)
} else {
    $lastSlash = $repository.LastIndexOf("/")
    $lastColon = $repository.LastIndexOf(":")
    if ($lastColon -gt $lastSlash) {
        $repository = $repository.Substring(0, $lastColon)
    }
}

$newImage = $repository + ":patch-" + (Get-Date).ToString("yyyyMMdd-HHmmss")
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) (
    "prodnex-deploy-file-" + [Guid]::NewGuid().ToString("N")
)
$patchRoot = Join-Path $tempRoot "patch"

Write-Host "Imagem base : $currentImage"
Write-Host "Nova imagem : $newImage"

try {
    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $patchRoot -Force | Out-Null
    }

    Write-Step "Preparando a camada incremental"
    foreach ($item in $items) {
        $destination = Join-Path $patchRoot $item.Relative
        Write-Host "Incluindo: $($item.Relative)"
        if ($DryRun) { continue }

        if ($item.IsDirectory) {
            New-Item -ItemType Directory -Path $destination -Force | Out-Null
            Get-ChildItem -LiteralPath $item.Source -Force | ForEach-Object {
                Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
            }
        } else {
            New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
            Copy-Item -LiteralPath $item.Source -Destination $destination -Force
        }
    }

    if (-not $DryRun) {
        $dockerfile = @(
            "FROM $currentImage",
            "WORKDIR /app",
            "COPY patch/ /app/"
        )
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllLines(
            (Join-Path $tempRoot "Dockerfile"),
            $dockerfile,
            $utf8NoBom
        )
    }

    Write-Step "Criando a imagem incremental"
    Invoke-GCloud -Arguments @(
        "builds", "submit", $tempRoot,
        "--tag=$newImage",
        "--region=$Region",
        "--project=$Project",
        "--quiet"
    )

    Write-Step "Publicando a nova revisão"
    Invoke-GCloud -Arguments @(
        "run", "deploy", $Service,
        "--image=$newImage",
        "--region=$Region",
        "--project=$Project",
        "--platform=managed",
        "--quiet"
    )

    $url = Invoke-GCloud -Capture -Arguments @(
        "run", "services", "describe", $Service,
        "--region=$Region",
        "--project=$Project",
        "--format=value(status.url)"
    )
    $revision = Invoke-GCloud -Capture -Arguments @(
        "run", "services", "describe", $Service,
        "--region=$Region",
        "--project=$Project",
        "--format=value(status.latestReadyRevisionName)"
    )

    Write-Host ""
    Write-Host "[OK] DEPLOY RÁPIDO FINALIZADO" -ForegroundColor Green
    Write-Host "Revisão : $revision"
    Write-Host "Imagem  : $newImage"
    Write-Host "URL     : $url" -ForegroundColor Green
} finally {
    if (-not $DryRun -and (Test-Path -LiteralPath $tempRoot)) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
