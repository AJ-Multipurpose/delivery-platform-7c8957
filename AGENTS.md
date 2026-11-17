# Project architecture

DBD is one React application with hostname-selected audiences. The customer homepage must retain exactly two content sections: Grocery and Restaurant, after its hero. Never add links or audience switchers between customer, driver, partner, and admin experiences. Only exact production hostnames select privileged app surfaces; Netlify preview hosts select the customer app.

## Key directories

- `src/App.tsx`: customer application, session handling, cart, authentication dialogs, shared order rendering.
- `src/Dashboard.tsx`: driver, partner, and administrator workspaces with permission-dependent onboarding.
- `src/LiveMap.tsx`: browser-initialized Leaflet maps; no server-side Leaflet import.
- `src/useLiveEvents.ts`: reconnecting, authenticated SSE subscriptions; events trigger permission-scoped API reloads.
- `src/i18n.ts`: paired English/Kiswahili copy. Some secondary dashboard and server error strings still need localization.
- `src/entry-server.tsx`: SSR document, siteName/siteDescription, metadata; no og:image because the platform supplies it.
- `src/styles.css`: theme tokens and responsive design. Sora headings, Manrope body, warm orange and deep green; dark mode uses token overrides.
- `shared`: seed catalog, money/CSV/ETA helpers, sender configuration.
- `netlify/server/index.mjs`: the only HTTP server entrypoint. Authentication, actor-scoped transactions, API endpoints, private file authorization, manifests, robots and sitemap, SSR.
- `db/schema.ts`: Drizzle schema. `db/index.ts` exposes the Netlify Drizzle adapter.
- `netlify/database/migrations`: generated base schema plus manually authored PL/pgSQL business rules, RLS and seed data. Netlify applies these at deploy time.
- `netlify/functions/send-order-emails.mts`: scheduled email outbox worker, not a general API endpoint.
- `android/customer`, `android/driver`: independent Capacitor/native Android projects; shared external signing logic is `android/signing.gradle`.
- `tests`: pure rule tests and opt-in transactional database integration tests.

## Conventions and invariants

Use integer TSh amounts everywhere. Never calculate authoritative order totals from browser-submitted prices. Monetary mutations and order/driver status transitions belong in database functions. Preserve unique ledger references, order idempotency keys, withdrawal reservations and the delivered-proof requirement. A delivered order credits exactly TSh 2,000 to its driver once.

Admin roles are held in a protected `roles` table, never user metadata. Approval and commission fields cannot be changed through owner-controlled payloads. Require confirmed Identity accounts, approved driver/shop records and background checks where applicable. RLS is defense in depth: the backend connection owns the tables and must always explicitly scope reads and recheck mutations. Never trust a browser-supplied user/owner/admin ID. Treat SQL null booleans as denied in permission checks.

Keep documents and proof photos in the private Blobs store. Only expose downloads through the authorized API; never return object keys in public catalog responses. Keep email credentials, native upload keys, provider credentials, and environment values outside source control and output. Release signing must fail if external keys are unavailable.

Add migrations for all schema changes, using drizzle-orm@beta and drizzle-kit@beta as required by the Netlify Database adapter. Do not rewrite an applied migration. Preserve hand-written functions, constraints, indexes, grants and RLS policies when updating schema snapshots. Do not run migration push/apply commands yourself.

The server runs on Node 24. Vite emits the client at `dist/assets/app.js`, styles at `dist/assets/app.css`, and the SSR entry at `dist-server/entry-server.js`. Do not add a static `dist/index.html` or a catch-all rewrite/framework function that shadows the Netlify Server.

Use Netlify Database for durable structured state and Netlify Blobs for files. Never substitute process memory or local JSON persistence. Current interface state (open panels and cart) is ephemeral; a durable cart requires database-backed storage.

## Known remaining work

Read README.md before claiming production completion. The seed is intentionally small, live refresh uses Postgres notifications/SSE with polling fallback, signed APK/AAB artifacts do not yet exist, and custom domains/OAuth/branded email require operator setup. No real-data end-to-end run has been completed. Native Google OAuth and background GPS require device-specific implementation and tests. Pure tests passed during continuation; database integration tests remain opt-in and have not been executed. The platform handles deployment build validation.
