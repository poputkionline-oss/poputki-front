/**
 * tests/phase_subscription_model_ticket_verification_cta.test.js
 *
 * POPUTKI.ONLINE — Manual Booking Telegram Subscription Model, the
 * "Открыть билет в Telegram" CTA inside TicketVerificationView.vue.
 *
 * Unlike the other subscription-model frontend test files, this one
 * exercises the REAL component methods via importVueScript (same technique
 * as phase_p1g3a_addendum_bus_tab_deeplink.test.js) instead of only
 * source-string matching — the whole point of this fix is runtime branching
 * behavior (never falling back to the legacy flow on error, blocking a
 * rapid double-click, closing the pre-opened window on failure, never
 * calling either start endpoint when the booking isn't currently
 * subscribable), which a static regex can't prove.
 *
 * ticket.subscriptionModelActive / ticket.canSubscribe are two INDEPENDENT
 * server-decided booleans (see routes/busTickets.js's GET /verify/:token and
 * its own backend test file,
 * tests/phase_subscription_model_verify_ticket_canSubscribe.test.js in
 * poputki-backend) — the frontend here only ever branches on those two
 * flags; it never re-derives "is this booking manual/subscribable" itself,
 * and never looks at claim_status/claimed_by_user_id to decide which model
 * to use.
 *
 *   subscriptionModelActive | canSubscribe | frontend behavior
 *   ------------------------|--------------|--------------------------------
 *   false                   | false        | legacy /claims/start-session
 *   true                    | false        | neither endpoint; "unavailable"
 *   true                    | true         | one-click /claims/start-subscription
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { importVueScript } from './helpers/extractVueScript.mjs';
import api from '../src/api.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const view = readFileSync(resolve('src/views/TicketVerificationView.vue'), 'utf-8');

class FakeWindow {
    constructor() {
        this.closed = false;
        this.location = { href: null };
        this.closeCalls = 0;
    }
    close() {
        this.closed = true;
        this.closeCalls++;
    }
}

function makeFakeThis(overrides = {}) {
    return {
        token: 'tok-123',
        ticket: { bookingId: 900, subscriptionModelActive: true, canSubscribe: true },
        subscribing: false,
        subscribeError: null,
        claiming: false,
        claimError: null,
        telegramDeepLink: null,
        ...overrides
    };
}

describe('TicketVerificationView.vue — real onSubscribeClick() behavior', () => {
    let TicketVerificationView;
    let originalWindowOpen;
    let openedWindows;

    beforeEach(async () => {
        const mod = await importVueScript('src/views/TicketVerificationView.vue');
        TicketVerificationView = mod.default;

        openedWindows = [];
        originalWindowOpen = global.window?.open;
        global.window = global.window || {};
        global.window.open = () => {
            const w = new FakeWindow();
            openedWindows.push(w);
            return w;
        };
    });

    afterEach(() => {
        mock.restoreAll();
        if (originalWindowOpen) global.window.open = originalWindowOpen;
    });

    it('1. manual + flag on + subscribable (both flags true): opens a blank window synchronously, calls ONLY /claims/start-subscription (never /claims/start-session), then navigates the pre-opened window', async () => {
        const postCalls = [];
        mock.method(api, 'post', async (url, body) => {
            postCalls.push({ url, body });
            return { data: { deepLink: 'https://t.me/Poputkionline_bot?start=subscribe_abcdef' } };
        });

        const fakeThis = makeFakeThis();
        await TicketVerificationView.methods.onSubscribeClick.call(fakeThis, { preventDefault() {} });

        assert.equal(postCalls.length, 1, 'exactly one backend call must be made');
        assert.equal(postCalls[0].url, '/claims/start-subscription');
        assert.equal(postCalls[0].body.verificationToken, 'tok-123');
        assert.equal(postCalls[0].body.bookingId, 900);
        assert.ok(!postCalls.some(c => c.url === '/claims/start-session'), 'legacy /claims/start-session must never be called on this path');

        assert.equal(openedWindows.length, 1, 'exactly one window must be pre-opened');
        assert.equal(openedWindows[0].location.href, 'https://t.me/Poputkionline_bot?start=subscribe_abcdef');
        assert.equal(openedWindows[0].closed, false, 'the successfully-navigated window must not be closed');
        assert.equal(fakeThis.subscribing, false, 'subscribing must be reset after completion');
        assert.equal(fakeThis.subscribeError, null);
    });

    it('2. manual + flag on but NOT currently subscribable (subscriptionModelActive true, canSubscribe false): onSubscribeClick calls neither endpoint and never starts a session', async () => {
        const postCalls = [];
        mock.method(api, 'post', async (url, body) => { postCalls.push(url); return { data: {} }; });

        const fakeThis = makeFakeThis({ ticket: { bookingId: 900, subscriptionModelActive: true, canSubscribe: false } });
        await TicketVerificationView.methods.onSubscribeClick.call(fakeThis, { preventDefault() {} });

        assert.equal(postCalls.length, 0, 'neither /claims/start-subscription nor /claims/start-session may be called when canSubscribe is false');
        assert.equal(openedWindows.length, 0, 'no window may be pre-opened when the booking is not currently subscribable');
        assert.equal(fakeThis.subscribing, false);
        assert.equal(fakeThis.subscribeError, null, 'this is not an error state — the template shows the plain "unavailable" message instead');
    });

    it('3. a rapid second click while the first request is still in flight is blocked — only one session is started', async () => {
        let resolveFirst;
        const pending = new Promise(resolve => { resolveFirst = resolve; });
        const postCalls = [];
        mock.method(api, 'post', async (url, body) => {
            postCalls.push({ url, body });
            await pending;
            return { data: { deepLink: 'https://t.me/Poputkionline_bot?start=subscribe_abcdef' } };
        });

        const fakeThis = makeFakeThis();
        const firstCall = TicketVerificationView.methods.onSubscribeClick.call(fakeThis, { preventDefault() {} });
        // Synchronously issue a second tap before the first request resolves.
        const secondCall = TicketVerificationView.methods.onSubscribeClick.call(fakeThis, { preventDefault() {} });

        resolveFirst();
        await Promise.all([firstCall, secondCall]);

        assert.equal(postCalls.length, 1, 'a rapid repeat click must never start a second subscription session');
        assert.equal(openedWindows.length, 1, 'only one window must ever be opened across both taps');
    });

    it('4. on failure: the pre-opened window is closed and a plain-language error is shown, never a silent fallback', async () => {
        mock.method(api, 'post', async () => {
            throw new Error('network down');
        });

        const fakeThis = makeFakeThis();
        await TicketVerificationView.methods.onSubscribeClick.call(fakeThis, { preventDefault() {} });

        assert.equal(openedWindows.length, 1);
        assert.equal(openedWindows[0].closed, true, 'the pre-opened blank window must be closed on failure');
        assert.equal(openedWindows[0].closeCalls, 1);
        assert.equal(typeof fakeThis.subscribeError, 'string');
        assert.ok(fakeThis.subscribeError.length > 0);
        assert.equal(fakeThis.subscribing, false);
    });

    it('5. an ambiguous/network subscribe error never touches the legacy claiming/claimError state — no automatic fallback to the claim flow', async () => {
        mock.method(api, 'post', async () => {
            throw new Error('ambiguous failure');
        });

        const fakeThis = makeFakeThis({ claiming: false, claimError: null, telegramDeepLink: null });
        await TicketVerificationView.methods.onSubscribeClick.call(fakeThis, { preventDefault() {} });

        assert.equal(fakeThis.claiming, false, 'legacy claiming flag must be untouched');
        assert.equal(fakeThis.claimError, null, 'legacy claimError must be untouched — only subscribeError may be set');
        assert.equal(fakeThis.telegramDeepLink, null, 'legacy telegramDeepLink must be untouched');
    });

    it('6. verifyTicket() (page load) never calls /claims/start-subscription or /claims/start-session by itself, for any flag combination', async () => {
        const postCalls = [];
        mock.method(api, 'post', async (url, body) => { postCalls.push(url); return { data: {} }; });
        mock.method(api, 'get', async () => ({ data: { valid: true, ticket: { bookingId: 900, subscriptionModelActive: true, canSubscribe: true } } }));

        const fakeThis = {
            token: 'tok-123',
            $route: { params: { token: 'tok-123' }, query: {} },
            error: null,
            loading: true,
            ticket: null,
            openTracked: false,
            trackTicketOpen() {}
        };
        await TicketVerificationView.methods.verifyTicket.call(fakeThis);

        assert.equal(postCalls.length, 0, 'loading the ticket page must never itself create a claim or subscription session');
        assert.equal(fakeThis.ticket.subscriptionModelActive, true);
        assert.equal(fakeThis.ticket.canSubscribe, true);
    });
});

describe('TicketVerificationView.vue — template branching (source-level)', () => {
    it('7. subscriptionModelActive is the ONLY gate for the legacy flow — the subscription block and the legacy block are mutually exclusive v-if/v-else siblings', () => {
        assert.match(view, /<template v-if="ticket\.subscriptionModelActive">/);
        const subscribeBlockIdx = view.indexOf('<template v-if="ticket.subscriptionModelActive">');
        const legacyElseIdx = view.indexOf('<template v-else>', subscribeBlockIdx);
        assert.ok(legacyElseIdx > subscribeBlockIdx, 'the legacy block must be the v-else sibling of the subscriptionModelActive block');

        const activeBlock = view.slice(subscribeBlockIdx, legacyElseIdx);
        const legacyBlock = view.slice(legacyElseIdx);

        // Inside the active block, canSubscribe further gates the one-click
        // CTA from the "unavailable" message — never the legacy flow.
        assert.match(activeBlock, /<template v-if="ticket\.canSubscribe">/);
        assert.match(activeBlock, /@click="onSubscribeClick"/);
        assert.ok(activeBlock.includes('Подключить уведомления в Telegram'));
        assert.ok(activeBlock.includes('Подключение уведомлений для этой поездки сейчас недоступно'), 'the not-currently-subscribable message must be present');
        assert.ok(!activeBlock.includes('@click="startClaimSession"'), 'the legacy claim method must never be wired inside the subscriptionModelActive block');

        assert.match(legacyBlock, /@click="startClaimSession"/);
        assert.ok(legacyBlock.includes('Открыть билет в Telegram'), 'legacy button text must be unchanged');
        assert.ok(legacyBlock.includes('Ссылка готова. Нажмите ещё раз, чтобы открыть Telegram.'), 'legacy two-tap hint must be unchanged');
        assert.ok(!legacyBlock.includes('@click="onSubscribeClick"'), 'the subscription method must never be wired inside the legacy block');
    });

    it('8. neither branch condition ever references claim_status/claimed_by_user_id — model selection is independent of claim state', () => {
        const gateLines = view.split('\n').filter(l => l.includes('ticket.subscriptionModelActive') || l.includes('ticket.canSubscribe'));
        assert.ok(gateLines.length > 0);
        for (const line of gateLines) {
            assert.ok(!line.includes('claim_status'), `branching condition must not reference claim_status: ${line.trim()}`);
            assert.ok(!line.includes('claimed_by_user_id'), `branching condition must not reference claimed_by_user_id: ${line.trim()}`);
        }
    });

    it('9. onSubscribeClick is defined as its own method, entirely separate from startClaimSession', () => {
        assert.match(view, /async onSubscribeClick\(e\)\s*\{/);
        assert.match(view, /async startClaimSession\(\)\s*\{/);
    });

    it('10. data() declares subscribing/subscribeError, independent of claiming/claimError', () => {
        assert.match(view, /subscribing: false,\s*\n\s*subscribeError: null/);
        assert.ok(view.includes('claiming: false'));
        assert.ok(view.includes('claimError: null'));
    });
});
