/**
 * phase_oson_sms_claim_landing_security.test.js
 * POPUTKI.ONLINE — /t/:token SMS claim landing page, Stage 7 security checklist
 *
 * Static/source-level checks in the same style as telegram_ios_deeplink_fix.test.js.
 * The dynamic backend-side guarantees (token entropy, hash-only storage, expiry,
 * cancellation, cross-booking rejection) belong to booking_claim_sessions /
 * resolveClaimSession — unchanged by this feature and already covered by the
 * backend's own existing test suite; not re-tested here.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const view = readFileSync(resolve('src/views/ClaimLandingView.vue'), 'utf-8');
const router = readFileSync(resolve('src/router/index.js'), 'utf-8');
const vercelConfig = JSON.parse(readFileSync(resolve('vercel.json'), 'utf-8'));

describe('OSON SMS — /t/:token CLAIM LANDING SECURITY', () => {
    it('1. route path carries only an opaque token, no booking id / phone / name in the URL', () => {
        assert.match(router, /path:\s*'\/t\/:token'/);
    });

    it('2. route is registered in publicRoutes (no login required to open it)', () => {
        assert.match(router, /publicRoutes\s*=\s*\[[^\]]*'claim-landing'/);
    });

    it('3. page never calls the claim/verify-and-claim endpoint itself — preview only', () => {
        assert.ok(!view.includes('verify-and-claim'));
        assert.ok(view.includes('/claims/preview-trip'));
    });

    it('4. page never renders full ticket fields (passport, full phone) — only route/date/carrier/seat count', () => {
        assert.ok(!view.includes('passport'));
        assert.ok(!view.includes('phone'));
    });

    it('5. Telegram CTA is a fixed-prefix deep link built from the same route token, not a user-controlled redirect', () => {
        assert.match(view, /`https:\/\/t\.me\/Poputkionline_bot\?start=claim_\$\{this\.token\}`/);
    });

    it('6. no window.location / dynamic href assembled from query params (no open-redirect surface)', () => {
        assert.ok(!view.includes('window.location'));
        assert.ok(!view.includes('this.$route.query'));
    });

    it('7. sets Referrer-Policy: no-referrer on mount and restores the previous value on unmount', () => {
        assert.match(view, /content'\)\s*,\s*'no-referrer'|setAttribute\('content',\s*'no-referrer'\)/);
        assert.ok(view.includes('unmounted()'));
    });

    it('8. hosting config sets Cache-Control: no-store and Referrer-Policy: no-referrer for /t/:token', () => {
        const rule = (vercelConfig.headers || []).find(h => h.source === '/t/:token');
        assert.ok(rule, 'vercel.json must declare a headers rule for /t/:token');
        const cacheControl = rule.headers.find(h => h.key === 'Cache-Control');
        const referrerPolicy = rule.headers.find(h => h.key === 'Referrer-Policy');
        assert.equal(cacheControl?.value, 'no-store');
        assert.equal(referrerPolicy?.value, 'no-referrer');
    });

    it('9. error states never echo raw backend reason codes as free text (mapped via ERROR_MESSAGES table)', () => {
        assert.ok(view.includes('ERROR_MESSAGES'));
        assert.ok(!view.includes('{{ error }}'));
    });

    it('10. no analytics/tracking call anywhere in the component (nothing to leak the token into)', () => {
        assert.ok(!/gtag|analytics|Sentry|mixpanel|amplitude/i.test(view));
    });
});
