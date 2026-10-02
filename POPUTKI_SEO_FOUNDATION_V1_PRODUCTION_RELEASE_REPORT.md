# SEO Foundation V1 — Production Release Report

BASE_SHA: 69e4d6d7c54d10f279e517c404f03f5b6bb8fe80
PRE_RELEASE_ORIGIN_MAIN_SHA: 69e4d6d7c54d10f279e517c404f03f5b6bb8fe80
SEO_COMMIT: 59354621b03c3ce30ab48d1f31ba3e254e533a08
CORRECTIVE_COMMIT: c9de3721d95b8fa232823ca26f50d39c33d0fd40
REPORT_COMMIT: e667f70fbbbcc1a002486d523a61c86c48287e64
FINAL_MAIN_SHA: 947003e8d0034861e2ef73d986961b243363c765 (merge commit of PR #10; contains all three commits above — verified with `git merge-base --is-ancestor`)
BRANCH_PUSH: DONE
MAIN_INTEGRATION: DONE (PR #10 merged by a human)
VERCEL_DEPLOYMENT: NOT_CONFIRMED. Only the PR-branch (preview) Vercel status for e667f70 is visible (success). No production deployment status for 947003e could be read from this session.
PRODUCTION_URL: https://www.poputki.online
LIVE CHECKS (HOME, TERMS, ROBOTS, SITEMAP, CANONICAL, NOINDEX, X_ROBOTS_TAG, SCHEMA, SEARCH, UNKNOWN_URL, SMOKE): NOT_VERIFIED. The session's egress proxy answered 403 to CONNECT for www.poputki.online:443 (environment network policy), so no live request could be made. No result is claimed.
KNOWN_LIMITATIONS: soft-404 HTTP 200 on unknown URLs; no 1200x630 social image; no non-JS noindex on /search and unknown URLs; missing PWA icon files.
PRODUCTION_BLOCKERS: live verification not possible from this environment (host not allowed by network policy). Fix: add www.poputki.online to the environment's allowed domains, or run the checks from a machine with access.
DEFERRED_TO_V2: real HTTP 404, prerender for /bus/{from}-{to}, social image, dynamic sitemap.

SEO_FOUNDATION_V1_PRODUCTION: FAILED
