 app<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f9ec8423-e0fb-4f1c-b0e1-1005d626a2d6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Daily Tracking Cron

Production daily tracking is intended to run through the Cloud Run Job defined by `scripts/run-daily-tracking.ts` and deployed with `setup-gcp-job.sh`.

- The supported Cloud Scheduler target is the Cloud Run Jobs API at `https://run.googleapis.com/v2/projects/<project>/locations/<region>/jobs/<job>:run`.
- The Scheduler job should use OAuth service account auth, not OIDC.
- The expected daily run key is fixed to `YYYY-MM-DDT09:00` in `Asia/Kolkata`.
- Verify successful executions in Firestore at `system/dailyTracking` and in each tracked user's `trackingSchedule.lastRunKey`.

The `/api/cron/run` endpoint remains available as a manual or emergency fallback, but it is not the primary production scheduler path.

## Dodo Billing

The app now exposes an authenticated Dodo billing flow inside the workspace:

- `GET /api/billing/status` returns the current subscription snapshot for the signed-in user.
- `POST /api/billing/checkout` creates a hosted Dodo checkout session for the configured product.
- `POST /api/billing/portal` opens the hosted Dodo customer portal for linked customers.
- `POST /api/dodo/webhook` verifies Dodo webhook signatures and syncs subscription state into Firestore.

Minimum environment setup:

- `APP_URL`
- `DODO_API_KEY` or `DODO_PAYMENTS_API_KEY`
- `DODO_WEBHOOK_SECRET` or `DODO_PAYMENTS_WEBHOOK_KEY`
- `DODO_PRODUCT_ID`
- `DODO_ENVIRONMENT` set to `test` / `live` or `test_mode` / `live_mode`

Optional per-plan product IDs for the authenticated paywall:

- `DODO_PRODUCT_ID_INDIE`
- `DODO_PRODUCT_ID_STARTER`
- `DODO_PRODUCT_ID_PRO`

If only `DODO_PRODUCT_ID` is set, the paywall uses that as the Starter checkout product.

In the Dodo dashboard, register `https://<your-domain>/api/dodo/webhook` and enable the subscription lifecycle events.
