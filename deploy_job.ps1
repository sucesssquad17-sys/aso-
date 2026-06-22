$ErrorActionPreference = "Stop"

$PROJECT_ID="aso-analyzer-pro-app"
$REGION="asia-south1"
$SA_EMAIL="tracking-worker-sa@${PROJECT_ID}.iam.gserviceaccount.com"
$IMAGE_NAME="gcr.io/${PROJECT_ID}/daily-tracking-worker"
$JOB_NAME="daily-tracking-worker"

echo "Building and pushing the Docker image using Cloud Build..."
gcloud builds submit --config=cloudbuild.job.yaml .

echo "Deploying the Cloud Run Job..."
gcloud run jobs deploy $JOB_NAME `
    --image=$IMAGE_NAME `
    --region=$REGION `
    --service-account=$SA_EMAIL `
    --max-retries=3 `
    --task-timeout=30m `
    --memory=512Mi `
    --cpu=1 `
    --update-env-vars="RESEND_API_KEY=re_ZCpc1hhe_Jpi5HfwJvnuecxnEgTsUATrf,RESEND_FROM_EMAIL=alerts@rankanalyzerpro.com,CRON_FAILURE_EMAIL=vantalumstudio@gmail.com"

echo "Deployment complete."
