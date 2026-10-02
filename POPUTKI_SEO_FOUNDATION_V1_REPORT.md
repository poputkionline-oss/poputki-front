# POPUTKI.ONLINE — SEO Foundation V1 Report

BASE_SHA: 69e4d6d7c54d10f279e517c404f03f5b6bb8fe80 (origin/main)
FINAL_LOCAL_SHA/WORKTREE: same HEAD as BASE_SHA + uncommitted worktree changes (nothing committed, nothing pushed)

FILES_CHANGED:
- M index.html — lang="ru", fallback title/description/canonical/OG/Twitter
- M src/main.js — `installSeo(router)` (2 lines)
- M src/router/index.js — catch-all `not-found` route (last) + `not-found` added to the guard's `publicRoutes`
- M src/views/LandingView.vue — removed "№1" badge text (1 line)
- M vite.config.js — manifest description + `lang: 'ru'`; `navigateFallbackDenylist` for /robots.txt, /sitemap.xml
- A src/seo/seoPolicy.js, src/seo/seoManager.js
- A src/views/NotFoundView.vue
- A public/robots.txt, public/sitemap.xml
- A tests/seo_policy.test.js
- A POPUTKI_SEO_FOUNDATION_V1_REPORT.md

SEO_MANAGER: `src/seo/seoManager.js` + pure policy `seoPolicy.js`. One `router.afterEach` hook. Each tag is upserted by selector (reused, duplicates collapsed, removed when not applicable), so nothing from the previous route survives. Title/robots/description/canonical/og:*/twitter:*/JSON-LD are all managed there; no dependency added.

ROUTE_POLICY (by route *name*; fail-safe: unknown name => noindex,nofollow):
- A. INDEX (`index,follow`): `/` , `/terms`
- B. PUBLIC FUNCTIONAL (`noindex,follow`): `/search` (semantics: links on it may be followed, page itself and its query-parameter variants must not be indexed)
- C. PRIVATE (`noindex,nofollow`): everything else — /create, /preferences, /bookings, /ride/:id(+select-seat), /bus-admin, /profile, /auth, /my-rides, /vehicle, /driver/:id/reviews, /user/:id, /bus-ticket/:id, /bus-booking/:id/step/:step, /my-bus-tickets, /my-reviews, /admin*, /payment-result, /ticket/:token, /ticket-verify/:token, /t/:token, /ticket-subscribe/:verificationToken, /ticket-preview, /l/:token, /r/:code, 404.
- A unit test asserts every route name in router/index.js has a policy entry and only landing+terms are indexable.

ROBOTS: public/robots.txt — Allow /, Disallow for private/service paths (incl. /ticket/, /ticket-verify/, /ticket-subscribe/, /t/, /l/, /r/, /bus-booking/), Sitemap line. JS/CSS/assets not blocked. Not treated as protection.
SITEMAP: public/sitemap.xml — `/` and `/terms` only; no lastmod (no reliable date); no query URLs.
CANONICAL: built from a fixed path + fixed origin `https://www.poputki.online`, never from the request URL, so utm_*, fbclid, gclid, tgWebApp*, processedStartParam, route params (tokens) can't enter it. Only indexable routes have a canonical; noindex routes have none (removed on navigation).
NOINDEX: verified in a real browser (see TESTS).
OPEN_GRAPH: og:type=website, site_name, title, description, url, image — per route, 6 unique tags, no duplicates. og:url for non-indexable routes is the site root (never a private URL).
TWITTER: summary card, title, description, image.
SCHEMA: JSON-LD `Organization` (name, url, logo) and `WebSite` (name, url, inLanguage) on `/` only; injected/removed by the manager. No rating/price/phone/address/sameAs/SearchAction/BusTrip/FAQ.
PWA: manifest description now "Поиск и бронирование автобусных рейсов и совместных поездок", lang ru. VitePWA/SW/icons config otherwise untouched; build generates SW (37 precache entries).
LANDING: "№1 Сервис совместных поездок" -> "Автобусные рейсы и совместные поездки". No other change.
SEARCH: functionally untouched; `/search?...` => noindex,follow, no canonical. Attribution params still scrubbed by the existing acquisitionService.
404: new catch-all `NotFoundView` (message + "На главную"), noindex,nofollow. Verified `/this-page-does-not-exist-seo-test-12345` renders it unauthenticated (added to `publicRoutes`, otherwise the guard would redirect to /auth).
  HTTP status: `vercel.json` rewrites `/(.*)` -> `/index.html`, so Vercel returns **HTTP 200** for unknown URLs (soft-404). Not changed in V1 (requires routing architecture change); noindex mitigates.
SECURITY: titles/descriptions are static strings; no route params/query/user data reach title, description, canonical, OG, JSON-LD or sitemap. Token routes are noindex,nofollow and also disallowed in robots.txt. Existing auth guard and /t/:token no-store headers untouched. Secret/PII scan of changed files: nothing found.
BUILD: `npm ci && npm run build` OK on base and after changes (only the pre-existing chunk-size warning).

TESTS:
- PASS `node --test tests/seo_policy.test.js` (6/6).
- PASS full `node --test tests/*.test.js`: baseline 614 tests / 12 fail; after 620 / 12 fail — same 12 pre-existing failures (`import.meta.env` undefined under plain node), 6 new passing.
- PASS `git diff --check`.
- PASS (Playwright/Chromium against `vite preview`, backend/Telegram hosts blocked): robots/canonical/title for `/`, `/terms`, `/search?...utm...`, `/ticket/X`, `/ticket-verify/X`, `/t/X`, `/ticket-subscribe/X`, `/payment-result`, `/auth`, `/profile`, `/admin`, `/bus-admin`, `/bus-ticket/5`, `/bus-booking/5/step/1`, `/ride/3`, unknown URL; `/?utm_source=..&gclid=..&processedStartParam=1` => canonical = `https://www.poputki.online/`; SPA navigation `/`->`/terms`->`/ticket/ABC`->`/` updates all tags with no leftovers; exactly 1 canonical/description/robots, 6 og:*, 4 twitter:*, JSON-LD only on `/`; `lang="ru"`; Landing, Terms, /search (bus tab), admin and bus-admin login screens render; /robots.txt (200 text/plain), /sitemap.xml (200 xml) served; manifest description updated.
- PASS (code inspection + browser): `/l/:token`, `/r/:code` route code untouched; browser attempted navigation to backend host.

NOT_VERIFIED (no E2E infra / needs real backend or Telegram):
- Actual booking flow end to end, rides search with live data, bus search results, /bus-ticket/:id and /bus-booking steps with real data (only reached the auth guard; guard/logic code untouched).
- Telegram Mini App navigation and `bus_*` / `ride_*` deep links (router guard untouched; needs Telegram WebApp context).
- Real-device PWA installability / SW update behaviour.
- Authenticated admin/bus-admin dashboards (only login screens rendered).
- HTTP status of unknown URLs on live Vercel (inferred from vercel.json; vite preview also returns 200).
- Google rich-results / sitemap validators (not run offline; sitemap is schema-conformant by inspection).

KNOWN_LIMITATIONS:
- Unknown URLs return HTTP 200 (soft 404) on Vercel.
- Social image: the only production asset is `/logo-itself.png` (376x453 logo). Used with `twitter:card=summary`. No 1200x630 preview exists; I did not invent one — recommend producing `/og-default.png`.
- Static `index.html` carries canonical=`/` and no robots meta; crawlers that don't run JS see the home canonical on every URL and no noindex on token pages (Googlebot renders JS, so the manager's values apply). Prerender/SSR in V2 resolves this.
- robots.txt Disallow stops crawlers from seeing `noindex` on those paths (URL-only listing is still theoretically possible); noindex is intentionally also set, and the pages are token-gated. Deliberate trade-off for token paths.
- Public manifest icons `pwa-192x192.png` / `pwa-512x512.png` and `favicon.ico`, `apple-touch-icon.png`, `masked-icon.svg` are referenced but absent from `public/` (pre-existing; installability risk, out of scope).
- Landing still has old "попутки" copy ("Создать попутку", "Найти попутку", "Для водителей", "Окупайте расходы на бензин", "Попути — дешевле и быстрее" H1): recommended for the next stage's positioning pass (bus-first H1/copy).
- `/ride/:id`, `/user/:id` are publicly reachable (existing guard) — now noindex,nofollow.

V2_SSR_SSG_RECOMMENDATION:
For `/bus/{from}-{to}` on Vue 3 + Vite + Vercel + VitePWA + Telegram Mini App:
- Full SSR/Nuxt: highest cost/risk (migrating a large SPA with Telegram/PWA/auth logic, Render backend cold starts in SSR path). Not recommended.
- Pure SSG/vite-ssg of all routes: route set is dynamic (trips change), rebuilds needed; poor fit alone.
- Prerender of a *small whitelisted set*: good for `/`, `/terms`, plus route landing pages.
- **Recommended hybrid**: keep the SPA for the app (booking, Telegram, admin). For SEO routes only, generate static HTML at build time (or via Vercel ISR / an edge function) from a backend "popular routes" endpoint: per-route title/description/canonical/BusTrip-less content (route, typical schedule/price range only if backed by data), a dynamic sitemap.xml generated from the same list, then hydrate into the existing SPA search view. Use a Vercel rewrite so only `/bus/*` is served prerendered, returning real 404 for unknown route slugs. Keep `/search`, tokens, booking noindex. Reuse `seoPolicy.js` (add route-level metadata) so the manager and prerender share one source of truth.

FINDINGS:
- CRITICAL: none.
- HIGH: none (soft-404 on Vercel is the nearest; rated MEDIUM since noindex mitigates).
- MEDIUM: (1) HTTP 200 for unknown URLs. (2) Static HTML lacks per-route robots/canonical for non-JS crawlers. (3) No proper social preview image. (4) Missing PWA icon files referenced in manifest (pre-existing).
- LOW: (1) 12 pre-existing failing node tests (env-dependent). (2) Old positioning copy on landing. (3) Per-route titles are generic/static (no dynamic route titles by design to avoid PII).

SEO_FOUNDATION_V1_READY_FOR_RELEASE: YES
