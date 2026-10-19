# +============================================================+
# | setup-github-deploy.ps1                                    |
# | One-time setup so the "Deploy Cloud Run" button in GitHub  |
# | Actions can deploy Prodnex without a key file.             |
# |   .\setup-github-deploy.ps1                                |
# | Creates (only if missing): the deploy account              |
# | github-deploy, the Workload Identity pool github-prodnex   |
# | (accepts only consartAdmin repositories) and the link to   |
# | this repository. Infinity's own setup is not touched.      |
# | At the end it prints the two GitHub variables and copies   |
# | .env.prod to the clipboard for the ENV_FILE secret.        |
# +============================================================+

param(
  [string]$Project = "erp-infinity-0-to-9",
  [string]$Repo = "consartAdmin/ERP-INDUSTRIES-00000",
  [string]$EnvFile = ".env.prod"
)

$ErrorActionPreference = "Continue"
$POOL     = "github-prodnex"
$PROVIDER = "github"
$SA_NAME  = "github-deploy"
$OWNER    = $Repo.Split("/")[0]

function G {
  # runs gcloud and stops the script if it fails
  & gcloud @args
  if ($LASTEXITCODE -ne 0) { throw "FAILED: gcloud $($args -join ' ')" }
}
function Exists {
  # true when the gcloud describe command finds the resource
  $null = & gcloud @args 2>&1
  return ($LASTEXITCODE -eq 0)
}

$NUM = (& gcloud projects describe $Project --format="value(projectNumber)").Trim()
if (-not $NUM) { throw "Could not read project $Project. Run: gcloud auth login" }
$SA         = "$SA_NAME@$Project.iam.gserviceaccount.com"
$RUNTIME_SA = "$NUM-compute@developer.gserviceaccount.com"
$POOL_PATH  = "projects/$NUM/locations/global/workloadIdentityPools/$POOL"

Write-Host "Project = $Project ($NUM)"
Write-Host "Repo    = $Repo"

Write-Host "`n[1/5] APIs" -ForegroundColor Cyan
G services enable iamcredentials.googleapis.com sts.googleapis.com cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com --project $Project

Write-Host "`n[2/5] Deploy account $SA" -ForegroundColor Cyan
if (Exists iam service-accounts describe $SA --project $Project) {
  Write-Host "already exists, keeping it."
} else {
  G iam service-accounts create $SA_NAME --display-name "GitHub deploy" --project $Project
}

Write-Host "`n[3/5] Permissions of the deploy account" -ForegroundColor Cyan
$roles = @(
  "roles/run.admin",                 # deploy Cloud Run
  "roles/cloudbuild.builds.editor",  # gcloud builds submit
  "roles/artifactregistry.writer",   # push the image
  "roles/storage.admin",             # build source upload + Deploy arquivos (bucket)
  "roles/serviceusage.serviceUsageConsumer",
  "roles/viewer"                     # read build logs and service settings
)
foreach ($r in $roles) {
  G projects add-iam-policy-binding $Project --member "serviceAccount:$SA" --role $r --condition None --quiet --format none
  Write-Host "  $r"
}
# deploy as the runtime account (default compute) used by the prodnex service
G iam service-accounts add-iam-policy-binding $RUNTIME_SA --member "serviceAccount:$SA" --role roles/iam.serviceAccountUser --project $Project --format none
Write-Host "  roles/iam.serviceAccountUser on $RUNTIME_SA"

Write-Host "`n[4/5] Workload Identity (GitHub login without a key)" -ForegroundColor Cyan
if (Exists iam workload-identity-pools describe $POOL --location global --project $Project) {
  Write-Host "pool $POOL already exists, keeping it."
} else {
  G iam workload-identity-pools create $POOL --location global --display-name "GitHub Prodnex" --project $Project
}
if (Exists iam workload-identity-pools providers describe $PROVIDER --workload-identity-pool $POOL --location global --project $Project) {
  Write-Host "provider $PROVIDER already exists, keeping it."
} else {
  G iam workload-identity-pools providers create-oidc $PROVIDER `
    --workload-identity-pool $POOL --location global --project $Project `
    --issuer-uri "https://token.actions.githubusercontent.com" `
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" `
    --attribute-condition "assertion.repository_owner=='$OWNER'"
}

Write-Host "`n[5/5] Allow $Repo to use $SA_NAME" -ForegroundColor Cyan
G iam service-accounts add-iam-policy-binding $SA --project $Project --format none `
  --role roles/iam.workloadIdentityUser `
  --member "principalSet://iam.googleapis.com/$POOL_PATH/attribute.repository/$Repo"

Write-Host ""
Write-Host "Done. In GitHub: Settings > Secrets and variables > Actions" -ForegroundColor Green
Write-Host ""
Write-Host "Variables tab > New repository variable (twice):"
Write-Host "  GCP_WIF_PROVIDER = $POOL_PATH/providers/$PROVIDER" -ForegroundColor Yellow
Write-Host "  GCP_SA_EMAIL     = $SA" -ForegroundColor Yellow

if (Test-Path $EnvFile) {
  Get-Content $EnvFile -Raw | Set-Clipboard
  Write-Host ""
  Write-Host "Secrets tab > New repository secret:"
  Write-Host "  Name ENV_FILE, then paste (Ctrl+V): $EnvFile is already in the clipboard." -ForegroundColor Yellow
} else {
  Write-Host "`n$EnvFile not found here: create the ENV_FILE secret with its contents by hand."
}
Write-Host ""
Write-Host "Wait 2 minutes, then Actions > Deploy Cloud Run > Run workflow (modo so-codigo)."
