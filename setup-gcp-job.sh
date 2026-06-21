#!/bin/bash
# Rank Analyzer Pro - Daily Tracking Worker Deployment Script
# Run this script in Google Cloud Shell

set -euo pipefail

# Configure your settings here
PROJECT_ID="aso-analyzer-pro-app"
REGION="asia-south1"
SERVICE_ACCOUNT_NAME="tracking-worker-sa"
IMAGE_NAME="gcr.io/$PROJECT_ID/daily-tracking-worker"
JOB_NAME="daily-tracking-worker"

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

echo "Building and pushing the Docker image using Cloud Build..."
# Note: we use Dockerfile.job here
gcloud builds submit --tag $IMAGE_NAME --config=cloudbuild.job.yaml .

echo "Deploying the Cloud Run Job..."
gcloud run jobs deploy $JOB_NAME \
    --image=$IMAGE_NAME \
    --region=$REGION \
    --service-account=$SA_EMAIL \
    --max-retries=3 \
    --task-timeout=30m \
    --memory=512Mi \
    --cpu=1

echo "Creating the Cloud Scheduler to run the job daily at 9:00 AM IST..."
# Clean up existing scheduler if we are recreating
gcloud scheduler jobs delete $JOB_NAME-trigger --location=$REGION --quiet || true

gcloud scheduler jobs create http $JOB_NAME-trigger \
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
echo "  1. gcloud scheduler jobs describe $JOB_NAME-trigger --location=$REGION"
echo "  2. gcloud scheduler jobs run $JOB_NAME-trigger --location=$REGION"
echo "  3. Verify system/dailyTracking and trackingSchedule.lastRunKey in Firestore"
