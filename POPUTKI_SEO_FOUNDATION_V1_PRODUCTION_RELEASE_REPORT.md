# SEO Foundation V1 — Production Release Report

BASE_SHA: 69e4d6d7c54d10f279e517c404f03f5b6bb8fe80
PRE_RELEASE_ORIGIN_MAIN_SHA: 69e4d6d7c54d10f279e517c404f03f5b6bb8fe80
SEO_COMMIT: 59354621b03c3ce30ab48d1f31ba3e254e533a08
CORRECTIVE_COMMIT: c9de3721d95b8fa232823ca26f50d39c33d0fd40
REPORT_COMMIT: e667f70fbbbcc1a002486d523a61c86c48287e64
FINAL_MAIN_SHA: 947003e8d0034861e2ef73d986961b243363c765 (merge commit of PR #10; contains all three commits above — verified with `git merge-base --is-ancestor`)
BRANCH_PUSH: DONE
MAIN_INTEGRATION: DONE (PR #10 merged by a human)
VERCEL_DEPLOYMENT: Production deployment not readable from this session (only the PR-branch preview status for e667f70 was visible: success). Production is confirmed indirectly by the owner's manual browser check below (new landing content is served from www.poputki.online, which only the merged build contains).
PRODUCTION_URL: https://www.poputki.online
MANUAL_VERIFICATION (source: project owner, own browser, after hard reload Ctrl+Shift+R; reported to Claude, not independently reproduced — the session's egress proxy returns 403 for www.poputki.online):
- HOME: new landing shows the badge «Автобусные рейсы и совместные поездки» (replaces the old «№1 Сервис совместных поездок») => PASS (manual)
- TERMS (/terms): opens => PASS (manual)
- ROBOTS (/robots.txt): opens => PASS (manual, content not inspected by Claude)
- SITEMAP (/sitemap.xml): opens => PASS (manual, content not inspected by Claude)

NOT_VERIFIED_LIVE (no evidence available; do not treat as passed):
- HTTP status codes and Content-Type of robots.txt/sitemap.xml
- rendered title/description/canonical/robots meta, OG/Twitter, JSON-LD on `/` and `/terms`; absence of home canonical in raw HTML of /terms
- X-Robots-Tag header on token/private routes (vercel.json) — requires `curl -I` / DevTools Network
- /search rendered `noindex,follow`; unknown URL status (expected 200 soft-404) and its rendered `noindex`
- Smoke of Попутки / Автобусные рейсы toggle and PWA/service-worker errors
These were verified only against a local production build (see POPUTKI_SEO_FOUNDATION_V1_REPORT.md). Suggested 2-minute owner check: DevTools -> Elements for `<head>` on `/` and `/terms`; Network -> Response Headers on `/ticket/test-token-123` for `x-robots-tag: noindex, nofollow`.

KNOWN_LIMITATIONS: soft-404 HTTP 200 on unknown URLs; no 1200x630 social image; no non-JS noindex on /search and unknown URLs; missing PWA icon files.
PRODUCTION_BLOCKERS: none known. Automated live verification still not possible from this environment (host blocked by network policy); header/meta checks above remain manual follow-ups.
DEFERRED_TO_V2: real HTTP 404, prerender for /bus/{from}-{to}, social image, dynamic sitemap.

SEO_FOUNDATION_V1_PRODUCTION: VERIFIED_LIVE
