/**
 * tests/phase_subscription_model_handoff_public_page.test.js
 *
 * POPUTKI.ONLINE — Manual Booking Telegram Subscription Model, full carrier
 * entry point: the "Передать билет" handoff modal in BusAdminView.vue must
 * prefer the new public /ticket-subscribe/:token page (ticketSubscribeUrl)
 * over the legacy /ticket-verify/:token page (ticketUrl) whenever the
 * backend has provided one — i.e. only when
 * MANUAL_BOOKING_SUBSCRIPTION_MODEL_ENABLED is on for this manual booking.
 * When it hasn't (flag off, or a non-manual booking), ticketSubscribeUrl is
 * always empty and every one of these falls through to the exact same
 * ticketUrl-based behavior that existed before this model.
 *
 * Same source-level regex-audit convention as
 * phase_subscription_model_carrier_count_ui.test.js (BusAdminView.vue is a
 * large single-file Options API component, not practical to mount here).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const busAdminPath = path.resolve('src/views/BusAdminView.vue');
const content = fs.readFileSync(busAdminPath, 'utf8');

describe('BusAdminView.vue — handoffModal.ticketSubscribeUrl state', () => {
    it('the top-level data() initializer declares ticketSubscribeUrl alongside ticketUrl/claimUrl', () => {
        const dataBlock = content.slice(content.indexOf('handoffModal: {'), content.indexOf('handoffModal: {') + 400);
        assert.match(dataBlock, /ticketSubscribeUrl:\s*''/);
    });

    it('openHandoffForBooking resets ticketSubscribeUrl to empty before fetching, never carrying over the previous booking\'s value', () => {
        const block = content.slice(
            content.indexOf('async openHandoffForBooking'),
            content.indexOf('async sendHandoffViaWhatsApp')
        );
        assert.match(block, /ticketSubscribeUrl:\s*''/);
    });

    it('openHandoffForBooking stores ticket_subscribe_url from the /claim-link response', () => {
        const block = content.slice(
            content.indexOf('async openHandoffForBooking'),
            content.indexOf('async sendHandoffViaWhatsApp')
        );
        assert.match(block, /this\.handoffModal\.ticketSubscribeUrl\s*=\s*res\.data\.ticket_subscribe_url\s*\|\|\s*''/);
    });

    it('the new-booking creation branch (isExisting: false) sets ticketSubscribeUrl from handoff.ticket_subscribe_url', () => {
        const anchor = 'bookingId: res.data.id || res.data.booking_id,';
        const block = content.slice(content.indexOf(anchor), content.indexOf(anchor) + 400);
        assert.match(block, /ticketSubscribeUrl:\s*h\.ticket_subscribe_url\s*\|\|\s*''/);
    });

    it('createHandoff captures ticketSubscribeUrl from the /handoff response and never crashes when the field is absent (flag off)', () => {
        const block = content.slice(
            content.indexOf('async createHandoff'),
            content.indexOf('effectiveTicketUrl(handoffData) {')
        );
        assert.match(block, /this\.handoffModal\.ticketSubscribeUrl\s*=\s*res\.data\.ticketSubscribeUrl\s*\|\|\s*''/);
    });
});

describe('BusAdminView.vue — effectiveTicketUrl() prefers ticketSubscribeUrl over ticketUrl everywhere', () => {
    const helperBlock = content.slice(content.indexOf('effectiveTicketUrl(handoffData)'), content.indexOf('effectiveTicketUrl(handoffData)') + 400);

    it('effectiveTicketUrl checks handoffData.ticketSubscribeUrl BEFORE handoffData.ticketUrl, and modal state in the same order', () => {
        const subscribeIdx = helperBlock.indexOf('handoffData?.ticketSubscribeUrl');
        const ticketIdx = helperBlock.indexOf('handoffData?.ticketUrl');
        const modalSubscribeIdx = helperBlock.indexOf('this.handoffModal.ticketSubscribeUrl');
        const modalTicketIdx = helperBlock.indexOf('this.handoffModal.ticketUrl');
        assert.ok(subscribeIdx !== -1 && ticketIdx !== -1 && modalSubscribeIdx !== -1 && modalTicketIdx !== -1);
        assert.ok(subscribeIdx < ticketIdx, 'handoffData.ticketSubscribeUrl must be preferred over handoffData.ticketUrl');
        assert.ok(modalSubscribeIdx < modalTicketIdx, 'handoffModal.ticketSubscribeUrl must be preferred over handoffModal.ticketUrl as the final fallback');
    });

    for (const [methodName, nextMarker] of [
        ['copyHandoffLink', 'setTimeout'],
        ['sendHandoffViaWhatsApp', 'passengerNames'],
        ['sendHandoffViaSms', 'passengerNames'],
        ['openHandoffTelegram', 'const message']
    ]) {
        it(`${methodName} resolves its ticket URL via effectiveTicketUrl(), not a raw ticketUrl fallback`, () => {
            const start = content.indexOf(`async ${methodName}`);
            const block = content.slice(start, content.indexOf(nextMarker, start));
            assert.match(block, /this\.effectiveTicketUrl\(handoffData\)/);
            assert.ok(!/handoffData\?\.ticketUrl \|\| this\.handoffModal\.ticketUrl/.test(block), `${methodName} must not fall back to the old raw ticketUrl-only expression`);
        });
    }

    it('openHandoffTicket (the "Открыть билет" button) resolves via effectiveTicketUrl() with no arguments (uses modal state only)', () => {
        const block = content.slice(content.indexOf('openHandoffTicket()'), content.indexOf('openHandoffTicket()') + 300);
        assert.match(block, /this\.effectiveTicketUrl\(\)/);
    });
});

describe('BusAdminView.vue — the blue "Поделиться / Открыть в Telegram" button never launches claim_<token> directly', () => {
    it('openHandoffTelegram never references claim_url/claimUrl in its own body', () => {
        const start = content.indexOf('async openHandoffTelegram');
        const block = content.slice(start, content.indexOf('async regenerateHandoffClaimLink'));
        assert.ok(!block.includes('claimUrl'));
        assert.ok(!block.includes('claim_url'));
    });

    it('openHandoffTelegram builds its Telegram share URL from effectiveTicketUrl() (the public ticket/subscribe page), never a bot deep link', () => {
        const start = content.indexOf('async openHandoffTelegram');
        const block = content.slice(start, content.indexOf('async regenerateHandoffClaimLink'));
        assert.match(block, /buildTelegramShareUrl\(\{\s*ticketUrl,\s*message\s*\}\)/);
        assert.ok(!/t\.me\/.*claim_/.test(block));
    });
});
