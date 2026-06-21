# Security Notes

## Hardening applied in this pass

- `/api/verify-paypal-subscription` now requires a Firebase bearer token and verifies the PayPal subscription server-side before granting premium access.
- `/api/tracking/state` has been retired and returns `410 Gone`.
- `/api/cron/run` now requires `x-cron-secret` backed by `CRON_SECRET`.
- Public scraper-heavy endpoints now have basic rate limiting and stricter request validation.
- Development server binding is loopback-only by default.

## Deferred dependency risk

`npm audit --omit=dev` still reports the `app-store-scraper -> request -> form-data/qs/tough-cookie` chain. This pass intentionally does not use `npm audit fix --force` because the suggested fix downgrades `app-store-scraper` to a breaking version.

Accepted temporary risk in this pass:

- The iOS App Store scraping path still depends on an unmaintained request-based chain.
- The route surface around that code has been reduced with validation and rate limits, but the dependency itself still needs replacement.

## Follow-up recommendation

Replace the iOS App Store data path with a maintained alternative instead of forcing an `app-store-scraper` downgrade. The next security pass should remove the request-based dependency chain entirely.
