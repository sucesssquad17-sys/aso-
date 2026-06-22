#!/bin/bash
# Rank Analyzer Pro - Daily Tracking Worker Deployment Script
# Run this script in Google Cloud Shell

set -euo pipefail

# Configure your settings here
PROJECT_ID="aso-analyzer-pro-app"
REGION="us-central1"
SERVICE_ACCOUNT_NAME="tracking-worker-sa"
SERVICE_NAME="aso-api"
IMAGE_NAME="$REGION-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/daily-tracking-worker:latest"
JOB_NAME="daily-tracking-worker"
SCHEDULER_NAME="$JOB_NAME-trigger"
ENV_EXPORT_FILE="$(mktemp)"
SERVICE_JSON_FILE="$(mktemp)"

cleanup() {
    rm -f "$ENV_EXPORT_FILE" "$SERVICE_JSON_FILE"
}

trap cleanup EXIT

echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

echo "Enabling necessary APIs..."
gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    cloudscheduler.googleapis.com \
    firestore.googleapis.com

echo "Creating Service Account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="Service Account for Daily Tracking Job" || true

SA_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

echo "Granting Firestore and Logging roles to Service Account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/datastore.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/run.invoker"

echo "Exporting runtime env vars from Cloud Run service $SERVICE_NAME..."
gcloud run services describe "$SERVICE_NAME" \
    --region="$REGION" \
    --format=json > "$SERVICE_JSON_FILE"

python3 - "$SERVICE_JSON_FILE" "$ENV_EXPORT_FILE" <<'PY'
import json
import sys

service_json_path, env_output_path = sys.argv[1:3]
with open(service_json_path, "r", encoding="utf-8") as handle:
    service = json.load(handle)

env_entries = (
    service.get("spec", {})
    .get("template", {})
    .get("spec", {})
    .get("containers", [{}])[0]
    .get("env", [])
)

with open(env_output_path, "w", encoding="utf-8") as handle:
    for entry in sorted(env_entries, key=lambda item: item.get("name", "")):
        name = entry.get("name")
        value = entry.get("value")
        if not name or value is None:
            continue
        escaped = str(value).replace("'", "''")
        handle.write(f"{name}: '{escaped}'\n")
    handle.write("NODE_ENV: 'production'\n")
PY

echo "Building and pushing the Docker image using Cloud Build..."
gcloud builds submit \
    --config=cloudbuild.job.yaml \
    --substitutions=_IMAGE_NAME="$IMAGE_NAME" \
    .

echo "Deploying the Cloud Run Job..."
gcloud run jobs deploy $JOB_NAME \
    --image=$IMAGE_NAME \
    --region=$REGION \
    --service-account=$SA_EMAIL \
    --max-retries=3 \
    --task-timeout=30m \
    --memory=512Mi \
    --cpu=1 \
    --env-vars-file="$ENV_EXPORT_FILE"

echo "Creating the Cloud Scheduler to run the job daily at 9:00 AM IST..."
# Clean up existing scheduler if we are recreating
gcloud scheduler jobs delete $SCHEDULER_NAME --location=$REGION --quiet || true

gcloud scheduler jobs create http $SCHEDULER_NAME \
    --location=$REGION \
    --schedule="0 9 * * *" \
    --time-zone="Asia/Kolkata" \
    --uri="https://run.googleapis.com/v2/projects/$PROJECT_ID/locations/$REGION/jobs/$JOB_NAME:run" \
    --http-method=POST \
    --headers="Content-Type=application/json" \
    --message-body='{}' \
    --oauth-service-account-email=$SA_EMAIL

echo "Deployment complete."
echo "Manual verification:"
echo "  1. gcloud scheduler jobs describe $SCHEDULER_NAME --location=$REGION"
echo "  2. gcloud scheduler jobs run $SCHEDULER_NAME --location=$REGION"
echo "  3. Verify system/dailyTracking and trackingSchedule.lastRunKey in Firestore"
