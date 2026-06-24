$ErrorActionPreference = "Stop"

$PROJECT_ID="aso-analyzer-pro-app"
$REGION="us-central1"
$SA_EMAIL="tracking-worker-sa@${PROJECT_ID}.iam.gserviceaccount.com"
$IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/daily-tracking-worker:latest"
$JOB_NAME="daily-tracking-worker"
$SERVICE_NAME="aso-api"
$envFile = New-TemporaryFile

try {
    echo "Exporting runtime env vars from Cloud Run service $SERVICE_NAME..."
    $serviceJson = gcloud run services describe $SERVICE_NAME --region=$REGION --format=json | ConvertFrom-Json
    $containers = $serviceJson.spec.template.spec.containers
    if (-not $containers) {
        $containers = $serviceJson.template.containers
    }
    if (-not $containers) {
        throw "Could not read container env vars from service $SERVICE_NAME."
    }

    $envMap = [ordered]@{}
    foreach ($entry in $containers[0].env) {
        if ($entry.name -and $null -ne $entry.value) {
            $envMap[$entry.name] = [string]$entry.value
        }
    }

    $envMap["NODE_ENV"] = "production"
    if ($env:RESEND_API_KEY) {
        $envMap["RESEND_API_KEY"] = $env:RESEND_API_KEY
    }
    if ($env:RESEND_FROM_EMAIL) {
        $envMap["RESEND_FROM_EMAIL"] = $env:RESEND_FROM_EMAIL
    }
    if ($env:CRON_FAILURE_EMAIL) {
        $envMap["CRON_FAILURE_EMAIL"] = $env:CRON_FAILURE_EMAIL
    }

    $yamlLines = foreach ($key in ($envMap.Keys | Sort-Object)) {
        $escapedValue = $envMap[$key].Replace("'", "''")
        "${key}: '${escapedValue}'"
    }
    Set-Content -Path $envFile -Value $yamlLines -Encoding UTF8

    echo "Building and pushing the Docker image using Cloud Build..."
    gcloud builds submit --config=cloudbuild.job.yaml --substitutions=_IMAGE_NAME="$IMAGE_NAME" .

    echo "Deploying the Cloud Run Job..."
    gcloud run jobs deploy $JOB_NAME `
        --image=$IMAGE_NAME `
        --region=$REGION `
        --service-account=$SA_EMAIL `
        --max-retries=3 `
        --task-timeout=30m `
        --memory=512Mi `
        --cpu=1 `
        --env-vars-file=$envFile

    echo "Deployment complete."
}
finally {
    Remove-Item $envFile -ErrorAction SilentlyContinue
}
