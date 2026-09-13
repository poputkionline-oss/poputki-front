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

    it('10. button text is "Добавить билет в Telegram", with a loading-state variant while a request is in flight', () => {
        assert.match(view, /\{\{\s*starting\s*\?\s*'Открываем Telegram…'\s*:\s*'Добавить билет в Telegram'\s*\}\}/);
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

    it('14. no raw query-param href assembly (no open-redirect surface); the only window.location use is reading the current, already-trusted page URL for the forward-share button', () => {
        assert.ok(!view.includes('this.$route.query'));
        const locationUses = view.match(/window\.location(\.\w+)?/g) || [];
        for (const use of locationUses) {
            assert.equal(use, 'window.location.href', `unexpected window.location usage: ${use}`);
        }
        // Never assigned to (that would be a redirect surface) — only read.
        assert.ok(!/window\.location\.href\s*=/.test(view));
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

describe('TICKET SUBSCRIBE — first-tap Telegram open (no artificial double click)', () => {
    const methodsBlock = view.slice(view.indexOf('onSubscribeClick(e) {'), view.indexOf('onForwardClick() {'));

    it('17. opens a blank window synchronously, inside the click handler, before the async start-subscription call', () => {
        const openIdx = methodsBlock.indexOf("window.open('about:blank', '_blank')");
        const fetchIdx = methodsBlock.indexOf('/claims/start-subscription');
        assert.ok(openIdx > -1, 'must synchronously pre-open a window to preserve the user-gesture context');
        assert.ok(openIdx < fetchIdx, 'the window must be opened before the async request, not after');
    });

    it('18. navigates the pre-opened window to the deep link once resolved, rather than requiring a second tap', () => {
        assert.match(methodsBlock, /newWindow\.location\.href\s*=\s*deepLink/);
    });

    it('19. a retry tap after telegramDeepLink is already set reopens the same link and does not call start-subscription again', () => {
        const retryIdx = methodsBlock.indexOf('if (this.telegramDeepLink)');
        assert.ok(retryIdx > -1);
        const retryBlock = methodsBlock.slice(retryIdx, retryIdx + 500);
        assert.match(retryBlock, /window\.open\(this\.telegramDeepLink,\s*'_blank'\)/);
        assert.match(retryBlock, /return;/);
    });

    it('20. guards against a second concurrent tap starting a second session while one is already in flight', () => {
        const guardIdx = methodsBlock.indexOf('if (this.starting) return;');
        assert.ok(guardIdx > -1 && guardIdx < methodsBlock.indexOf('this.starting = true;'));
    });
});

describe('TICKET SUBSCRIBE — "Переслать билет пассажиру" forward/share button', () => {
    it('21. renders a secondary button labeled exactly "Переслать билет пассажиру"', () => {
        assert.match(view, /@click="onForwardClick"[\s\S]*?Переслать билет пассажиру/);
    });

    it('22. onForwardClick never calls start-subscription or any backend endpoint (pure client-side share/copy)', () => {
        const start = view.indexOf('async onForwardClick()');
        assert.ok(start > -1, 'onForwardClick method not found');
        const block = view.slice(start, view.indexOf('}\n    }\n};', start));
        assert.ok(!block.includes('api.post'));
        assert.ok(!block.includes('api.get'));
        assert.ok(!block.includes('start-subscription'));
    });

    it('23. prefers the Web Share API (navigator.share) when available', () => {
        const start = view.indexOf('async onForwardClick()');
        const block = view.slice(start, view.indexOf('async onForwardClick()') + 900);
        assert.match(block, /navigator\.share\s*\(/);
    });

    it('24. falls back to copyToClipboard and shows "Ссылка на билет скопирована" when Web Share is unavailable', () => {
        assert.ok(view.includes("import { copyToClipboard } from '../telegram';"));
        const start = view.indexOf('async onForwardClick()');
        const block = view.slice(start, view.indexOf('async onForwardClick()') + 900);
        assert.match(block, /copyToClipboard\(shareUrl\)/);
        assert.ok(block.includes('Ссылка на билет скопирована'));
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
