# Daily Basis Delivery

Daily Basis Delivery (DBD) is a Dar es Salaam delivery application with separate customer, driver, partner, and administrator experiences. The customer storefront pairs a fresh grocery catalog with local restaurant menus. All prices and financial records use integer Tanzanian Shillings.

## Technology

React 19, TypeScript, Vite, Tailwind CSS, and theme-token CSS power the interface. React server rendering runs through an Express Netlify Server. Netlify Database supplies managed Postgres, with a Drizzle schema and deployment migrations. Netlify Identity handles accounts; Netlify Blobs stores private onboarding documents and delivery photos. A scheduled Netlify Function processes transactional email through Resend. Separate Capacitor 7 Android projects target the customer and driver subdomains.

The project uses custom React SSR rather than TanStack Start so the Netlify Server receives API and rendering traffic without a framework catch-all function taking precedence.

## Local development

Install Node.js 24 and dependencies with `npm install`, link the project in the Netlify CLI, and run `netlify dev --port 8889`. The Netlify runtime is needed for Database and Blobs. Identity flows require a deployed site. The normal deployment build produces the client in `dist` and the SSR module in `dist-server`; do not publish a static root index.html, since the server renders the root route.

Hostname routing selects `driver.dailybasicdelivery.com`, `partner.dailybasicdelivery.com`, and `admin.dailybasicdelivery.com` exactly. `app.dailybasicdelivery.com` and the Netlify preview hostname render the customer application. There is intentionally no app switcher or customer link to another audience's app. Custom subdomains must be attached to the project, pointed to Netlify, and have TLS before use.

## Database and access

`db/schema.ts` defines the tables. Generated schema SQL and hand-written business-function/RLS migrations live in `netlify/database/migrations`. Netlify applies migrations at deploy time; do not apply or push them manually. New schema changes require a new generated migration.

The browser never receives database credentials. Each authenticated API request verifies its Identity token and confirmed email, then sets the actor ID inside a database transaction. Public table privileges are revoked, every table has RLS, and SQL functions recheck the actor's permissions. Runtime queries execute with the backend database identity; explicit query scopes and function checks are therefore required even with RLS in place.

`place_order` locks products, uses current prices, decrements stock, and fixes delivery at TSh 2,000. Grocery orders become ready immediately. `accept_delivery` locks the driver and atomically assigns an unclaimed ready order. `update_order_status` validates transitions, restores cancelled stock once, requires a driver-owned proof photo, and credits the driver and shop through uniquely referenced ledger entries. Withdrawals reserve available funds; payment writes a debit rather than clearing balances. Commission is snapshotted on each order.

Initial administrator access is reserved for the operator-supplied `ajecknorbertm@gmail.com` account. After canonical Identity confirmation, the first verified profile sync claims a one-time database marker and inserts the protected `admin` role. An already verified matching profile is handled by the deployment migration. There is no browser role assignment endpoint. The marker prevents automatic re-grant after revocation; it must never be reset during ordinary operations. This access becomes active only after the migration deploys and the account confirms its email.

## Email and authentication setup

`shared/email.mjs` is the sender configuration source, including the auth sender export. Verify `dailybasicdelivery.com` with Resend and configure `RESEND_API_KEY` securely in the production runtime. The Resend API key was configured securely for production and deploy previews; no provider credential was added to this repository. Domain verification and actual email delivery remain unverified. The scheduled worker runs in production, claims outbox records with row locks, and sends with provider idempotency keys. A missing provider configuration leaves events pending for retry.

Google OAuth credentials are not yet available. Identity still needs Google OAuth enabled, all four production origins in its redirect allowlist, and its SMTP sender configured to the shared `notify@dailybasicdelivery.com` address. The source constant does not configure Identity SMTP automatically. Password recovery explicitly requests a return to the initiating origin, which must be allowlisted. Email verification must remain enabled.

## Android projects

`android/customer` uses `com.dailybasicdelivery.customer` and the name **DBD App**. `android/driver` uses `com.dailybasicdelivery.driver` and **DBD Driver**. Each includes a native Android project, launch branding, location permissions, a remote HTTPS origin, and an external signing configuration.

For either project, run `npx cap sync android` from its directory, then open its native project with Android Studio using Java 21 and the required Android SDK. Release signing reads `DBD_CUSTOMER_KEYSTORE`, `DBD_CUSTOMER_STORE_PASSWORD`, `DBD_CUSTOMER_KEY_ALIAS`, and `DBD_CUSTOMER_KEY_PASSWORD`; the driver uses the corresponding `DBD_DRIVER_` names. These values belong only in an external secure release environment. Keystore files must be outside this repository; release tasks reject missing signing configuration or a keystore inside the repository.

After configuring that environment, the native Gradle `assembleRelease` and `bundleRelease` tasks produce APK and AAB artifacts. No signed binaries were produced in this run. Native Google OAuth redirects, GPS permission behavior, background location requirements, uploads, and Play policy compliance still require physical-device testing before distribution. Current GPS sharing is foreground browser/WebView geolocation, not an Android background tracking service.

## Verification

`npm test` runs pure business-rule, localization-key, and email tests. Set `DBD_DATABASE_TESTS=1` only against a disposable migrated database branch to enable the rollback-based integration tests. Those cover authoritative prices, fees, stock, forbidden actors, delivery transitions, proof requirements, assignment exclusivity, ledger idempotency, withdrawal minimums, reservations, and payments. They do not replace concurrent load testing, browser tests, or an authenticated real-data end-to-end acceptance run.

The pure automated tests were executed during continuation and passed. Database integration cases remained skipped because no disposable migrated database was selected. No builds or dev servers were run; deployment build validation is performed by the platform. Files were reviewed and formatted, and migration files were generated without applying them.

## Current scope and remaining acceptance work

The operator confirmed that production inventory and an external Android signing environment are not yet available. The seed is a starter catalog of **24 grocery products in seven grocery groups, six menu items, one grocery shop, and three restaurants**. It is sample launch content, not a verified inventory of operating merchants. The requested approximately 500 products and 70 categories still require expansion or an approved inventory import. The grocery catalog also provides shop selection for additional approved grocery shops.

Postgres LISTEN/NOTIFY triggers publish actor-targeted changes through a reconnecting Server-Sent Events subscription. Screens fetch updated records through the scoped APIs rather than exposing records in event messages. Order and wallet screens also poll at 12–15 seconds and admin screens every 30 seconds as fallback. Leaflet/OpenStreetMap maps display live driver and destination positions, including the admin fleet view. Each live subscription currently occupies one database connection; connection capacity needs load testing before large-scale rollout. Arrival distance is a coordinate-based estimate with a 1.35 road factor, not a routing-engine measured route. The city speed is configurable, defaulting to 22 km/h.

Remaining secondary/error-message localization, a persisted cart, broader analytics, exhaustive permission/business-rule tests, and native Google OAuth/background GPS handling remain acceptance gaps. Product editing supports text, SKU, category, price, stock, availability, and JPEG/PNG photo uploads for existing products. Admin screens include sales bars, driver ledger/settlement inspection, and expense entry. Server-rendered detail metadata reads the current public catalog. Operational performance, provider behavior, email idempotency across extended outages, and concurrent assignment/payment races still require acceptance and load tests.

The application is a reviewable implementation foundation, not a certified production-ready completion of the entire project brief. Domain/DNS ownership, Google OAuth, verified email delivery, verification of the reserved administrator account, production inventory, external Android signing, and a real-data order-to-payout acceptance run remain necessary before launch.

Legal pages, workflow statuses, product table headings, and partner earnings labels include English/Kiswahili copy. Administrator order review includes proof-photo selection and private review before confirming delivery; database checks still require a photo uploaded by the assigned driver for that exact order. The customer sitemap includes approved product and restaurant detail routes.

The shared order view also localizes pickup/delivery map links, driver fallback names, map stale-position tooltips, and modal close labels. Browser location errors distinguish denied permission, unavailable position, and timeouts in English and Kiswahili. Driver and partner wallet timestamps use the selected language and Dar es Salaam timezone. The latest continuation passed 11 pure tests; 10 opt-in database scenarios remained skipped.
