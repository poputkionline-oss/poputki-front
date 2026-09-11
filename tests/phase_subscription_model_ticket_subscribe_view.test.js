/**
 * phase_subscription_model_ticket_subscribe_view.test.js
 * POPUTKI.ONLINE — Manual Booking Telegram Subscription Model, frontend.
 *
 * Static/source-level checks in the same style as
 * phase_oson_sms_claim_landing_security.test.js and
 * phase_claim_landing_seat_display_hotfix.test.js (no compiler/mount
 * harness for .vue SFCs in this repo's test runner).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const view = readFileSync(resolve('src/views/TicketSubscribeView.vue'), 'utf-8');
const router = readFileSync(resolve('src/router/index.js'), 'utf-8');
const claimLandingView = readFileSync(resolve('src/views/ClaimLandingView.vue'), 'utf-8');

describe('TICKET SUBSCRIBE — new versioned route, old /t/:token untouched', () => {
    it('1. new route path is /ticket-subscribe/:verificationToken, not /t/:token', () => {
        assert.match(router, /path:\s*'\/ticket-subscribe\/:verificationToken'/);
    });

    it('2. new route is registered in publicRoutes', () => {
        assert.match(router, /publicRoutes\s*=\s*\[[^\]]*'ticket-subscribe'/);
    });

    it('3. old /t/:token claim-landing route still exists, unchanged path/name/component', () => {
        assert.match(router, /path:\s*'\/t\/:token'/);
        assert.match(router, /name:\s*'claim-landing'/);
        assert.match(router, /component:\s*\(\)\s*=>\s*import\('\.\.\/views\/ClaimLandingView\.vue'\)/);
    });

    it('4. old claim-landing route is still in publicRoutes', () => {
        assert.match(router, /publicRoutes\s*=\s*\[[^\]]*'claim-landing'/);
    });

    it('5. ClaimLandingView.vue source is untouched by this change (no subscribe-preview/start-subscription reference)', () => {
        assert.ok(!claimLandingView.includes('subscribe-preview'));
        assert.ok(!claimLandingView.includes('start-subscription'));
        assert.ok(!claimLandingView.includes('ticket-subscribe'));
    });
});

describe('TICKET SUBSCRIBE — uses only the new endpoints, never the old claim ones', () => {
    it('6. calls /claims/subscribe-preview on mount, never /claims/preview-trip', () => {
        assert.ok(view.includes('/claims/subscribe-preview'));
        assert.ok(!view.includes('/claims/preview-trip'));
    });

    it('7. calls /claims/start-subscription for the Telegram button, never /claims/start-session', () => {
        assert.ok(view.includes('/claims/start-subscription'));
        assert.ok(!view.includes("'/claims/start-session'"));
    });

    it('8. never references booking_claim_sessions concepts (claim_ deep link prefix)', () => {
        assert.ok(!view.includes('claim_${'));
        assert.ok(!/start=claim_/.test(view));
    });
});

describe('TICKET SUBSCRIBE — required texts (owner-approved copy)', () => {
    it('9. explains both the "your ticket" and "forward to the real passenger" cases', () => {
        assert.ok(view.includes('Если билет оформлен для вас'));
        assert.ok(view.includes('перешлите'));
    });

    it('10. button text is exactly "Добавить билет в Telegram"', () => {
        assert.match(view, />\s*Добавить билет в Telegram\s*</);
    });

    it('11. does NOT contain the retired "only the passenger should press this" warning (inconsistent with multi-subscriber model)', () => {
        assert.ok(!view.includes('Нажимать эту кнопку должен пассажир'));
    });
});

describe('TICKET SUBSCRIBE — privacy and safety invariants', () => {
    it('12. never renders full ticket fields (passport, full phone)', () => {
        assert.ok(!view.includes('passport'));
        assert.ok(!/\bphone\b/.test(view));
    });

    it('13. sets Referrer-Policy: no-referrer on mount and restores previous value on unmount (same pattern as ClaimLandingView.vue)', () => {
        assert.match(view, /setAttribute\('content',\s*'no-referrer'\)/);
        assert.ok(view.includes('unmounted()'));
    });

    it('14. no window.location / raw query-param href assembly (no open-redirect surface)', () => {
        assert.ok(!view.includes('window.location'));
        assert.ok(!view.includes('this.$route.query'));
    });

    it('15. error states are mapped via a table, never echo a raw backend code as free text', () => {
        assert.ok(view.includes('ERROR_MESSAGES'));
        assert.ok(!view.includes('{{ error }}'));
    });

    it('16. hides the subscribe button when canSubscribe is false (cancelled/completed/grace-period-expired)', () => {
        assert.match(view, /v-if="canSubscribe"/);
        assert.match(view, /v-if="!canSubscribe"/);
    });
});

describe('TICKET SUBSCRIBE — seatsLabel computed behaves like the fixed ClaimLandingView pattern', () => {
    function extractComputed(name) {
        const match = view.match(new RegExp(`${name}\\s*\\(\\)\\s*\\{([\\s\\S]*?)\\n\\s{8}\\}`));
        assert.ok(match, `${name}() computed not found`);
        // eslint-disable-next-line no-new-func
        const fn = new Function(`return function ${name}() {${match[1]}}`)();
        return (ctx) => fn.call(ctx);
    }

    it('one seat -> "Место: 78"', () => {
        const seatsLabel = extractComputed('seatsLabel');
        assert.equal(seatsLabel({ trip: { seatNumbers: [78] } }), 'Место: 78');
    });

    it('multiple seats -> "Места: 12, 13"', () => {
        const seatsLabel = extractComputed('seatsLabel');
        assert.equal(seatsLabel({ trip: { seatNumbers: [12, 13] } }), 'Места: 12, 13');
    });

    it('empty/missing seats -> null (no line rendered)', () => {
        const seatsLabel = extractComputed('seatsLabel');
        assert.equal(seatsLabel({ trip: { seatNumbers: [] } }), null);
        assert.equal(seatsLabel({ trip: {} }), null);
    });
});
