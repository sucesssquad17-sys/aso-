# Rank Analyzer Pro

Rank Analyzer Pro is a TypeScript SaaS for ASO teams that track keyword rankings, compare competitors, monitor ASO changes, and review reports across Google Play and the App Store.

## Features

- Multi-country keyword tracking for Android and iOS
- Competitor groups with ASO comparison snapshots and change alerts
- Daily scheduled tracking with deduplicated rank history
- In-app, push, and email alert rules
- PDF and reporting exports
- Dodo Payments subscription gating with trial activation

## Tech Stack

- React 19 + Vite + TypeScript
- Express + Node.js
- Firebase Auth + Firestore + Firebase Admin
- Dodo Payments
- Resend for alert emails
- Google GenAI for keyword discovery and analysis support

## Local Setup

1. Run `npm install`.
2. Copy `.env.example` to `.env` and fill in the required values.
3. Start development with `npm run dev`.

The Vite frontend and Express server run from the same repo entrypoint in development.
Firebase client config is loaded at runtime from `GET /api/public-config`, so
the service environment must provide the public `VITE_FIREBASE_*` variables.

## Required Environment Variables

Frontend Firebase client:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

These values are read by the Node/Express service at runtime and returned to the
browser through `/api/public-config`. They are not loaded from a private local
JSON file during `vite build`.

Server/runtime essentials:

- `APP_URL`
- `GEMINI_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
- `CRON_SECRET`

Billing:

- `DODO_API_KEY` or `DODO_PAYMENTS_API_KEY`
- `DODO_WEBHOOK_SECRET` or `DODO_PAYMENTS_WEBHOOK_KEY`
- `DODO_ENVIRONMENT`
- plan product IDs such as `DODO_PRODUCT_ID_STARTER`, `DODO_PRODUCT_ID_PRO`, and yearly variants

Optional:

- `VITE_FIREBASE_VAPID_KEY` for browser push
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` for email alerts
- `ADMIN_EMAIL_ALLOWLIST` for protected test email sends
- `EMAIL_UNSUBSCRIBE_SECRET` for announcement email unsubscribe links
- `PROXY_HOST`, `PROXY_PORT`, `PROXY_USERNAME`, `PROXY_PASSWORD` for proxy fallback
- `VITE_SENTRY_DSN`

## Commands

- `npm run dev`
- `npm run lint`
- `npm run lint:strict`
- `npm run check:tracking-timezone`
- `npm run build`
- `npm run build:job`

## Daily Tracking Job

The production daily tracker lives in `scripts/run-daily-tracking.ts` and is intended to run as a Cloud Run Job triggered by Cloud Scheduler.

- Global tracking defaults are fixed to `09:00` in `Asia/Kolkata`
- Firestore run status is written to `system/dailyTracking`
- User schedule state is written to `users/{uid}.trackingSchedule.lastRunKey`
- `/api/cron/run` is the manual fallback
- `/api/cron/watchdog` is the retry watchdog endpoint

## Billing Notes

The authenticated billing flow is server-owned:

- `GET /api/billing/status`
- `POST /api/billing/checkout`
- `POST /api/billing/portal`
- `POST /api/dodo/webhook`

Webhook events are signature-verified and duplicate webhook IDs are ignored. Plan selection stays gated until the server confirms active billing.

## Deployment Notes

- Configure Firebase Auth, Firestore, and Firebase Admin credentials for both the web service and the tracking job
- Set the public `VITE_FIREBASE_*` client variables on the Cloud Run web service runtime environment so `/api/public-config` can serve them to the browser and push service worker
- Register the Dodo webhook at `https://<your-domain>/api/dodo/webhook`
- If you use alert emails, configure a verified Resend sender
- Do not commit secrets, service-account files, or `.firebase` deploy cache artifacts
