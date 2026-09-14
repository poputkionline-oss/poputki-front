/**
 * tests/phase_subscription_model_passenger_ticket_cta.test.js
 *
 * POPUTKI.ONLINE — Manual Booking Telegram Subscription Model, the "large
 * ticket" carrier-facing modal (PassengerTicket.vue, embedded via
 * CarrierTripBookings.vue → BusAdminView.vue's own trip bookings list).
 *
 * Exercises the REAL component methods via importVueScript (same technique
 * as phase_subscription_model_ticket_verification_cta.test.js) — the point
 * of this fix is runtime branching (never falling back to legacy on error,
 * blocking a rapid double-click, closing the pre-opened window on failure,
 * never calling either endpoint when not currently subscribable), which a
 * static regex can't prove.
 *
 * ticket.subscriptionModelActive / ticket.canSubscribe are two independent
 * server-decided booleans from GET /bus-admin/bookings/:bookingId/ticket
 * (see poputki-backend's routes/busAdmin.js and its own test file,
 * tests/phase_subscription_model_carrier_single_ticket.test.js). The new
 * gate here is deliberately independent of the legacy ticket.isManual field.
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { importVueScript } from './helpers/extractVueScript.mjs';
import api from '../src/api.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const view = readFileSync(resolve('src/components/ticket/PassengerTicket.vue'), 'utf-8');

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

function makeFakeThis(ticketOverrides = {}, dataOverrides = {}) {
    return {
        ticket: {
            bookingId: 900,
            verificationToken: 'tok-900',
            status: 'confirmed',
            isManual: true,
            isClaimed: false,
            claimStatus: 'unclaimed',
            subscriptionModelActive: true,
            canSubscribe: true,
            ...ticketOverrides
        },
        subscribing: false,
        subscribeError: '',
        openingTelegram: false,
        telegramError: '',
        telegramDeepLink: '',
        canUseSubscriptionModel: true,
        ...dataOverrides
    };
}

describe('PassengerTicket.vue — real onSubscribeClick() behavior', () => {
    let PassengerTicket;
    let originalWindowOpen;
    let openedWindows;

    beforeEach(async () => {
        const mod = await importVueScript('src/components/ticket/PassengerTicket.vue');
        PassengerTicket = mod.default;

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

    it('1. booking-486-like fixture (isManual only reliable via canonical backend field, unreliable legacy channel/source_type not modeled client-side at all): subscriptionModelActive+canSubscribe true -> subscribe CTA path taken', async () => {
        const postCalls = [];
        mock.method(api, 'post', async (url, body) => {
            postCalls.push({ url, body });
            return { data: { deepLink: 'https://t.me/Poputkionline_bot?start=subscribe_abcdef' } };
        });

        const fakeThis = makeFakeThis();
        await PassengerTicket.methods.onSubscribeClick.call(fakeThis);

        assert.equal(postCalls.length, 1);
        assert.equal(postCalls[0].url, '/claims/start-subscription');
        assert.equal(postCalls[0].body.verificationToken, 'tok-900');
        assert.equal(postCalls[0].body.bookingId, 900);
    });

    it('2. active=true + canSubscribe=true: calls ONLY /claims/start-subscription, never /claims/start-session', async () => {
        const postCalls = [];
        mock.method(api, 'post', async (url, body) => {
            postCalls.push(url);
            return { data: { deepLink: 'https://t.me/Poputkionline_bot?start=subscribe_abcdef' } };
        });

        const fakeThis = makeFakeThis();
        await PassengerTicket.methods.onSubscribeClick.call(fakeThis);

        assert.ok(!postCalls.includes('/claims/start-session'));
        assert.equal(openedWindows.length, 1);
        assert.equal(openedWindows[0].location.href, 'https://t.me/Poputkionline_bot?start=subscribe_abcdef');
    });

    it('3. active=true + canSubscribe=false: onSubscribeClick calls neither endpoint', async () => {
        const postCalls = [];
        mock.method(api, 'post', async (url) => { postCalls.push(url); return { data: {} }; });

        const fakeThis = makeFakeThis({ canSubscribe: false }, { canUseSubscriptionModel: false });
        await PassengerTicket.methods.onSubscribeClick.call(fakeThis);

        assert.equal(postCalls.length, 0);
        assert.equal(openedWindows.length, 0);
    });

    it('4. subscribe request fails: pre-opened window closes, subscribeError is set, legacy state (telegramError/telegramDeepLink/openingTelegram) stays untouched', async () => {
        mock.method(api, 'post', async () => { throw new Error('ambiguous failure'); });

        const fakeThis = makeFakeThis({}, { telegramError: '', telegramDeepLink: '', openingTelegram: false });
        await PassengerTicket.methods.onSubscribeClick.call(fakeThis);

        assert.equal(openedWindows.length, 1);
        assert.equal(openedWindows[0].closed, true, 'pre-opened window must be closed on failure');
        assert.ok(fakeThis.subscribeError.length > 0);
        assert.equal(fakeThis.subscribing, false);
        assert.equal(fakeThis.telegramError, '', 'legacy telegramError must be untouched — no fallback to legacy on error');
        assert.equal(fakeThis.telegramDeepLink, '', 'legacy telegramDeepLink must be untouched');
        assert.equal(fakeThis.openingTelegram, false, 'legacy openingTelegram must be untouched');
    });

    it('6. a rapid second click while the first request is in flight is blocked — only one session started', async () => {
        let resolveFirst;
        const pending = new Promise(resolve => { resolveFirst = resolve; });
        const postCalls = [];
        mock.method(api, 'post', async (url) => {
            postCalls.push(url);
            await pending;
            return { data: { deepLink: 'https://t.me/Poputkionline_bot?start=subscribe_abcdef' } };
        });

        const fakeThis = makeFakeThis();
        const first = PassengerTicket.methods.onSubscribeClick.call(fakeThis);
        const second = PassengerTicket.methods.onSubscribeClick.call(fakeThis);

        resolveFirst();
        await Promise.all([first, second]);

        assert.equal(postCalls.length, 1);
        assert.equal(openedWindows.length, 1);
    });
});

describe('PassengerTicket.vue — legacy path and other callers (backward compatibility)', () => {
    let PassengerTicket;

    beforeEach(async () => {
        const mod = await importVueScript('src/components/ticket/PassengerTicket.vue');
        PassengerTicket = mod.default;
    });

    it('5. subscriptionModelActive=false: legacy openTicketInTelegram still calls /claims/start-session exactly as before', async () => {
        const postCalls = [];
        mock.method(api, 'post', async (url, body) => { postCalls.push({ url, body }); return { data: { deepLink: 'https://t.me/Poputkionline_bot?start=claim_xyz' } }; });

        // openTicketInTelegram() itself checks this.canOpenTelegram, which
        // is a real `computed` on the actual component — not present on
        // this plain fake `this`, so it's supplied directly (mirroring what
        // Vue's reactivity would have provided for a manual, confirmed,
        // unclaimed ticket.isManual booking).
        const fakeThis = makeFakeThis({ subscriptionModelActive: false, canSubscribe: false }, { canOpenTelegram: true });
        await PassengerTicket.methods.openTicketInTelegram.call(fakeThis);

        assert.equal(postCalls.length, 1);
        assert.equal(postCalls[0].url, '/claims/start-session');
        mock.restoreAll();
    });

    it('8. other current callers of PassengerTicket.vue (no subscriptionModelActive/canSubscribe fields at all) fall through to legacy, unaffected', async () => {
        const fakeThis = makeFakeThis({}, {});
        // Simulate a caller (e.g. bulk print manifest) whose ticket object
        // simply never had the new fields set.
        delete fakeThis.ticket.subscriptionModelActive;
        delete fakeThis.ticket.canSubscribe;

        const canUseSubscriptionModel = PassengerTicket.computed.canUseSubscriptionModel.call(fakeThis);
        const canOpenTelegram = PassengerTicket.computed.canOpenTelegram.call(fakeThis);

        assert.equal(canUseSubscriptionModel, false, 'without the new fields, the subscription gate must be false');
        assert.equal(canOpenTelegram, true, 'legacy gate must still work exactly as before for callers that never send the new fields');
        mock.restoreAll();
    });
});

describe('PassengerTicket.vue — template branching and printing (source-level)', () => {
    it('7. printTicket() only calls window.print — no backend call, no claim/subscription session created by opening or printing the ticket itself', () => {
        const printMethod = view.match(/printTicket\(\)\s*\{([\s\S]*?)\n\s{8}\},/);
        assert.ok(printMethod, 'printTicket() method not found');
        assert.ok(printMethod[1].includes('window.print()'));
        assert.ok(!printMethod[1].includes('api.'));
    });

    it('the subscription block and the legacy block are mutually exclusive v-if/v-else siblings gated on ticket.subscriptionModelActive, not ticket.isManual', () => {
        const blockIdx = view.indexOf('<template v-if="ticket.subscriptionModelActive">');
        assert.ok(blockIdx > -1);
        const elseIdx = view.indexOf('<template v-else>', blockIdx);
        assert.ok(elseIdx > blockIdx);

        const subscribeBlock = view.slice(blockIdx, elseIdx);
        assert.match(subscribeBlock, /@click="onSubscribeClick"/);
        assert.ok(subscribeBlock.includes('Подключить уведомления в Telegram'));
        assert.ok(subscribeBlock.includes('Подключение уведомлений для этой поездки сейчас недоступно'));
        assert.ok(!subscribeBlock.includes('@click="openTicketInTelegram"'));

        const legacyBlock = view.slice(elseIdx);
        assert.match(legacyBlock, /@click="openTicketInTelegram"/);
        assert.ok(legacyBlock.includes('Открыть билет в Telegram'), 'legacy text must be unchanged');
    });

    it('the outer container is gated on canUseSubscriptionModel OR canOpenTelegram, and canUseSubscriptionModel never references ticket.isManual', () => {
        assert.match(view, /v-if="canUseSubscriptionModel \|\| canOpenTelegram"/);
        const start = view.indexOf('canUseSubscriptionModel()');
        const end = view.indexOf('\n        }\n    },', start);
        const body = view.slice(start, end);
        assert.ok(!body.includes('ticket?.isManual') && !body.includes('ticket.isManual'), 'canUseSubscriptionModel must not depend on the legacy isManual field');
        assert.ok(body.includes('subscriptionModelActive'));
    });
});
