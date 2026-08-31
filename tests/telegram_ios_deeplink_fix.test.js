/**
 * telegram_ios_deeplink_fix.test.js — Phase E.4.1 iOS Safari Telegram deep-link fix
 * POPUTKI.ONLINE
 *
 * Verifies the two-step tap flow: first tap fetches the Telegram link and stores
 * it in state (no navigation), second tap is a native <a href> click so the
 * navigation to the https://t.me/ universal link happens inside a fresh,
 * synchronous user gesture (required by iOS Safari).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const verificationView = readFileSync(resolve('src/views/TicketVerificationView.vue'), 'utf-8');
const passengerTicket = readFileSync(resolve('src/components/ticket/PassengerTicket.vue'), 'utf-8');

describe('PHASE E.4.1 — IOS TELEGRAM DEEP-LINK FIX', () => {

    it('1. TicketVerificationView.vue declares claiming/claimError/telegramDeepLink in data()', () => {
        assert.match(verificationView, /data\(\)\s*{\s*return\s*{[\s\S]*?claiming: false[\s\S]*?claimError: null[\s\S]*?telegramDeepLink: null[\s\S]*?};/);
    });

    it('2. TicketVerificationView.vue no longer navigates via window.location', () => {
        assert.ok(!verificationView.includes('window.location'));
    });

    it('3. TicketVerificationView.vue validates the returned link starts with https://t.me/', () => {
        assert.ok(verificationView.includes("deepLink.startsWith('https://t.me/')"));
    });

    it('4. TicketVerificationView.vue does not re-request a session while a link is already held', () => {
        assert.ok(verificationView.includes('if (this.telegramDeepLink || this.claiming) return;'));
    });

    it('5. TicketVerificationView.vue renders a real <a href> once the link is ready, and the fetch button otherwise', () => {
        assert.match(verificationView, /<a\s+v-if="telegramDeepLink"\s+:href="telegramDeepLink"/);
        assert.match(verificationView, /<button\s+v-else\s+@click="startClaimSession"/);
    });

    it('6. TicketVerificationView.vue shows a plain-language ready hint without technical jargon', () => {
        assert.ok(verificationView.includes('Ссылка готова. Нажмите ещё раз, чтобы открыть Telegram.'));
        for (const bannedWord of ['claim', 'session', 'token', 'deep link', 'deeplink']) {
            assert.ok(
                !verificationView.toLowerCase().includes(`>${bannedWord}`),
                `visible UI text must not contain the technical term "${bannedWord}"`
            );
        }
    });

    it('7. PassengerTicket.vue declares telegramDeepLink in data()', () => {
        assert.match(passengerTicket, /data\(\)\s*{\s*return\s*{[\s\S]*?openingTelegram: false[\s\S]*?telegramError: ''[\s\S]*?telegramDeepLink: ''[\s\S]*?};/);
    });

    it('8. PassengerTicket.vue no longer navigates via window.location', () => {
        assert.ok(!passengerTicket.includes('window.location'));
    });

    it('9. PassengerTicket.vue validates the returned link starts with https://t.me/', () => {
        assert.ok(passengerTicket.includes("deepLink.startsWith('https://t.me/')"));
    });

    it('10. PassengerTicket.vue does not re-request a session while a link is already held', () => {
        assert.ok(passengerTicket.includes('if (this.telegramDeepLink || this.openingTelegram) return;'));
    });

    it('11. PassengerTicket.vue renders a real <a href> once the link is ready, and the fetch button otherwise', () => {
        assert.match(passengerTicket, /<a\s+v-if="telegramDeepLink"\s+:href="telegramDeepLink"/);
        assert.match(passengerTicket, /<button\s+v-else\s+@click="openTicketInTelegram"/);
    });

    it('12. PassengerTicket.vue canOpenTelegram gate is unchanged (manual, confirmed, not claimed)', () => {
        assert.match(passengerTicket, /canOpenTelegram\(\)\s*{\s*return Boolean\(\s*this\.ticket\?\.bookingId\s*&&\s*this\.ticket\?\.verificationToken\s*&&\s*this\.ticket\?\.status === 'confirmed'\s*&&\s*this\.ticket\?\.isManual\s*&&\s*!this\.ticket\?\.isClaimed\s*&&\s*this\.ticket\?\.claimStatus !== 'claimed'\s*\);/);
    });

    it('13. PassengerTicket.vue keeps the Telegram action inside the no-print screen action bar', () => {
        const barIndex = passengerTicket.indexOf('no-print flex items-center justify-between');
        const ctaIndex = passengerTicket.indexOf('v-if="canOpenTelegram"');
        const printMediaIndex = passengerTicket.indexOf('@media print');
        assert.ok(barIndex !== -1, 'no-print action bar must still exist');
        assert.ok(ctaIndex > barIndex, 'Telegram CTA must remain inside the no-print action bar');
        assert.ok(printMediaIndex !== -1, 'print media block must still exist');
        assert.match(
            passengerTicket,
            /\.no-print\s*\{\s*display:\s*none\s*!important;\s*\}/,
            'print stylesheet must still hide .no-print'
        );
    });

    it('14. Neither file leaks the deep-link or raw token to console logging', () => {
        assert.ok(!/console\.(log|error|warn|info)\([^)]*deepLink/i.test(verificationView));
        assert.ok(!/console\.(log|error|warn|info)\([^)]*deepLink/i.test(passengerTicket));
    });
});
