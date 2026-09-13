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
 * rapid double-click, closing the pre-opened window on failure), which a
 * static regex can't prove.
 *
 * ticket.canSubscribe is a server-decided boolean (see
 * routes/busTickets.js's GET /verify/:token and its own backend test file,
 * tests/phase_subscription_model_verify_ticket_canSubscribe.test.js in
 * poputki-backend) — the frontend here only ever branches on that flag; it
 * never re-derives "is this booking subscribable" itself.
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
        ticket: { bookingId: 900, canSubscribe: true },
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

    it('1. success: opens a blank window synchronously, calls ONLY /claims/start-subscription (never /claims/start-session), then navigates the pre-opened window', async () => {
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

    it('2. a rapid second click while the first request is still in flight is blocked — only one session is started', async () => {
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

    it('3. on failure: the pre-opened window is closed and a plain-language error is shown, never a silent fallback', async () => {
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

    it('4. an ambiguous/network subscribe error never touches the legacy claiming/claimError state — no automatic fallback to the claim flow', async () => {
        mock.method(api, 'post', async () => {
            throw new Error('ambiguous failure');
        });

        const fakeThis = makeFakeThis({ claiming: false, claimError: null, telegramDeepLink: null });
        await TicketVerificationView.methods.onSubscribeClick.call(fakeThis, { preventDefault() {} });

        assert.equal(fakeThis.claiming, false, 'legacy claiming flag must be untouched');
        assert.equal(fakeThis.claimError, null, 'legacy claimError must be untouched — only subscribeError may be set');
        assert.equal(fakeThis.telegramDeepLink, null, 'legacy telegramDeepLink must be untouched');
    });

    it('5. verifyTicket() (page load) never calls /claims/start-subscription or /claims/start-session by itself', async () => {
        const postCalls = [];
        mock.method(api, 'post', async (url, body) => { postCalls.push(url); return { data: {} }; });
        mock.method(api, 'get', async () => ({ data: { valid: true, ticket: { bookingId: 900, canSubscribe: true } } }));

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
        assert.equal(fakeThis.ticket.canSubscribe, true);
    });
});

describe('TicketVerificationView.vue — template branching (source-level)', () => {
    it('6. the subscription CTA is gated on ticket.canSubscribe, and the legacy CTA is its v-else — mutually exclusive, so flag-off/non-manual/non-subscribable bookings all render the untouched legacy button', () => {
        assert.match(view, /<template v-if="ticket\.canSubscribe">/);
        const subscribeBlockIdx = view.indexOf('<template v-if="ticket.canSubscribe">');
        const elseBlockIdx = view.indexOf('<template v-else>', subscribeBlockIdx);
        assert.ok(elseBlockIdx > subscribeBlockIdx, 'the legacy block must be the v-else sibling of the subscription block');

        const subscribeBlock = view.slice(subscribeBlockIdx, elseBlockIdx);
        assert.match(subscribeBlock, /@click="onSubscribeClick"/);
        assert.ok(subscribeBlock.includes('Подключить уведомления в Telegram'));

        const legacyBlock = view.slice(elseBlockIdx);
        assert.match(legacyBlock, /@click="startClaimSession"/);
        assert.ok(legacyBlock.includes('Открыть билет в Telegram'), 'legacy button text must be unchanged');
        assert.ok(legacyBlock.includes('Ссылка готова. Нажмите ещё раз, чтобы открыть Telegram.'), 'legacy two-tap hint must be unchanged');
    });

    it('7. onSubscribeClick is defined as its own method, entirely separate from startClaimSession', () => {
        assert.match(view, /async onSubscribeClick\(e\)\s*\{/);
        assert.match(view, /async startClaimSession\(\)\s*\{/);
    });

    it('8. data() declares subscribing/subscribeError, independent of claiming/claimError', () => {
        assert.match(view, /subscribing: false,\s*\n\s*subscribeError: null/);
        assert.ok(view.includes('claiming: false'));
        assert.ok(view.includes('claimError: null'));
    });
});
