/**
 * tests/phase_subscription_model_carrier_count_ui.test.js
 *
 * POPUTKI.ONLINE — Manual Booking Telegram Subscription Model, carrier-
 * facing follower count UI in BusAdminView.vue's handoff modal.
 *
 * Same source-level regex-audit convention as phase_e41_reopen_handoff_ui.test.js
 * and friends (BusAdminView.vue is a large single-file Options API component,
 * not practical to mount in isolation here).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const busAdminPath = path.resolve('src/views/BusAdminView.vue');
const content = fs.readFileSync(busAdminPath, 'utf8');

describe('BusAdminView.vue — handoffModal.telegramSubscribersCount state', () => {
    it('handoffModal data() initializer declares telegramSubscribersCount: null', () => {
        const dataBlock = content.slice(content.indexOf('handoffModal: {'), content.indexOf('handoffModal: {') + 600);
        assert.match(dataBlock, /telegramSubscribersCount:\s*null/);
    });

    it('openHandoffForBooking resets telegramSubscribersCount to null before fetching, never carrying over the previous booking\'s count', () => {
        const block = content.slice(
            content.indexOf('async openHandoffForBooking'),
            content.indexOf('async sendHandoffViaWhatsApp')
        );
        assert.match(block, /telegramSubscribersCount:\s*null/);
    });
});

describe('BusAdminView.vue — telegram-subscribers-count fetch', () => {
    const block = content.slice(
        content.indexOf('async openHandoffForBooking'),
        content.indexOf('async sendHandoffViaWhatsApp')
    );

    it('calls GET /bus-admin/bookings/:bookingId/telegram-subscribers-count', () => {
        assert.match(block, /api\.get\(`\/bus-admin\/bookings\/\$\{bookingId\}\/telegram-subscribers-count`\)/);
    });

    it('is fire-and-forget: never awaited inline, never throws into the claim-link try/catch (its own .catch swallows failures)', () => {
        const fetchIdx = block.indexOf('api.get(`/bus-admin/bookings/${bookingId}/telegram-subscribers-count`)');
        const line = block.slice(Math.max(0, fetchIdx - 50), fetchIdx);
        assert.ok(!/await\s+$/.test(line.trim() + ' '), 'must not be awaited — this must never block or fail the claim-link flow');
        const chainBlock = block.slice(fetchIdx, fetchIdx + 400);
        assert.match(chainBlock, /\.catch\(\(\) => \{\}\)/);
    });

    it('guards against a stale response overwriting a newer modal state (checks handoffModal.bookingId still matches)', () => {
        const fetchIdx = block.indexOf('api.get(`/bus-admin/bookings/${bookingId}/telegram-subscribers-count`)');
        const chainBlock = block.slice(fetchIdx, fetchIdx + 400);
        assert.match(chainBlock, /this\.handoffModal\.bookingId === bookingId/);
    });
});

describe('BusAdminView.vue — template renders the count only when > 0, aggregate only', () => {
    const templateBlock = content.slice(content.indexOf('v-if="handoffModal.show"'));

    it('renders "Билет добавлен в Telegram: N раз" gated on count > 0', () => {
        assert.match(templateBlock, /v-if="handoffModal\.telegramSubscribersCount > 0"/);
        assert.ok(templateBlock.includes('Билет добавлен в Telegram'));
        assert.match(templateBlock, /\{\{\s*handoffModal\.telegramSubscribersCount\s*\}\}\s*раз/);
    });

    it('the banner never renders any per-subscriber identity field (aggregate count only)', () => {
        const bannerIdx = templateBlock.indexOf('handoffModal.telegramSubscribersCount > 0');
        const bannerBlock = templateBlock.slice(bannerIdx, bannerIdx + 300);
        const forbidden = ['telegram_id', 'user_id', 'username', 'phone', 'name'];
        for (const field of forbidden) {
            assert.ok(!bannerBlock.includes(field), `banner block referenced forbidden per-subscriber field: ${field}`);
        }
    });
});
