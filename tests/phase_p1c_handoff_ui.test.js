/**
 * phase_p1c_handoff_ui.test.js
 * 
 * Phase P.1C–P.1E: Frontend Carrier Handoff, Ticket Open Tracking, and Telegram Share Tests
 * POPUTKI.ONLINE
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    normalizePhoneForHandoff,
    buildHandoffMessage,
    buildWhatsAppHandoffUrl,
    buildSmsHandoffUrl,
    buildTelegramShareUrl
} from '../src/utils/whatsAppHandoff.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const busAdminPath = path.resolve(__dirname, '../src/views/BusAdminView.vue');
const busAdminSource = fs.readFileSync(busAdminPath, 'utf-8');

const ticketVerificationPath = path.resolve(__dirname, '../src/views/TicketVerificationView.vue');
const ticketVerificationSource = fs.readFileSync(ticketVerificationPath, 'utf-8');

describe('PHASE P.1C–P.1E — FRONTEND HANDOFF & TICKET CORRELATION', () => {

    describe('1. WhatsApp Handoff Channel', () => {
        it('[P1C-01] buildWhatsAppHandoffUrl generates wa.me URL with normalized phone and encoded message', () => {
            const url = buildWhatsAppHandoffUrl({
                phone: '+992 92 792 50 51',
                message: 'Ваш билет: https://poputki.online/ticket/123?h=handoff-uuid'
            });
            assert.ok(url);
            assert.ok(url.startsWith('https://wa.me/992927925051?text='));
            assert.ok(url.includes(encodeURIComponent('https://poputki.online/ticket/123?h=handoff-uuid')));
        });

        it('[P1C-02] WhatsApp message contains canonical ticket URL with handoff query param', () => {
            const msg = buildHandoffMessage({
                channel: 'whatsapp',
                name: 'Акмалхон',
                fromCity: 'Худжанд',
                toCity: 'Москва',
                departureDate: '10.09.2026',
                seats: '12',
                ticketUrl: 'https://poputki.online/ticket/123?h=handoff-456'
            });
            assert.ok(msg.includes('https://poputki.online/ticket/123?h=handoff-456'));
            assert.ok(msg.includes('Худжанд - Москва'));
            assert.ok(!msg.includes('t.me/Poputkionline_bot?start='));
        });

        it('[P1C-03] BusAdminView implements safe popup blocker handling for WhatsApp', () => {
            assert.ok(busAdminSource.includes("window.open('about:blank', '_blank')"));
            assert.ok(busAdminSource.includes("newWindow.location.href = url"));
            assert.ok(busAdminSource.includes("newWindow.close()"));
        });
    });

    describe('2. SMS Handoff Channel', () => {
        it('[P1C-04] buildSmsHandoffUrl generates sms: URI with +prefix and encoded body', () => {
            const url = buildSmsHandoffUrl({
                phone: '+7 999 123 45 67',
                message: 'Билет: https://poputki.online/ticket/123?h=handoff-789'
            });
            assert.ok(url);
            assert.ok(url.startsWith('sms:+79991234567?body='));
            assert.ok(url.includes(encodeURIComponent('https://poputki.online/ticket/123?h=handoff-789')));
        });

        it('[P1C-05] BusAdminView uses synchronous direct navigation for native SMS', () => {
            assert.ok(busAdminSource.includes('sendHandoffViaSms'));
            assert.ok(busAdminSource.includes('window.location.href = url'));
            assert.ok(busAdminSource.includes('Открыто приложение SMS. Отправка инициирована через SMS.'));
        });
    });

    describe('3. Telegram Share Channel (Carrier Bot Direct Launch Removal)', () => {
        it('[P1C-06] buildTelegramShareUrl produces https://t.me/share/url (NOT bot start URL)', () => {
            const shareUrl = buildTelegramShareUrl({
                ticketUrl: 'https://poputki.online/ticket/123?h=handoff-tg-1',
                message: 'Ваш электронный билет'
            });
            assert.ok(shareUrl);
            assert.ok(shareUrl.startsWith('https://t.me/share/url?url='));
            assert.ok(!shareUrl.includes('t.me/Poputkionline_bot?start='));
        });

        it('[P1C-07] Carrier Telegram button invokes openHandoffTelegram using Telegram Share', () => {
            assert.ok(busAdminSource.includes('openHandoffTelegram'));
            assert.ok(busAdminSource.includes("createHandoff('telegram')"));
            assert.ok(busAdminSource.includes('buildTelegramShareUrl'));
            assert.ok(!busAdminSource.includes("t.me/Poputkionline_bot?start=claim_"));
        });
    });

    describe('4. Copy Link & Carrier Preview Mode', () => {
        it('[P1C-08] copyHandoffLink creates copy_link handoff and copies URL with handoffId', () => {
            assert.ok(busAdminSource.includes('copyHandoffLink'));
            assert.ok(busAdminSource.includes("createHandoff('copy_link')"));
            assert.ok(busAdminSource.includes('copyToClipboard(ticketUrl)'));
            assert.ok(busAdminSource.includes('Ссылка на билет скопирована'));
        });

        it('[P1C-09] openHandoffTicket appends preview=carrier to prevent passenger LINK_OPENED tracking', () => {
            assert.ok(busAdminSource.includes('openHandoffTicket'));
            assert.ok(busAdminSource.includes('preview=carrier'));
            assert.ok(busAdminSource.includes("window.open(previewUrl, '_blank')"));
        });
    });

    describe('5. Ticket Verification View Tracking & CTA (P.1D & P.1E)', () => {
        it('[P1D-01] TicketVerificationView extracts handoffId from query param h', () => {
            assert.ok(ticketVerificationSource.includes('this.$route.query.h'));
        });

        it('[P1D-02] TicketVerificationView excludes carrier preview from open tracking', () => {
            assert.ok(ticketVerificationSource.includes("this.$route.query.preview === 'carrier'"));
            assert.ok(ticketVerificationSource.includes('trackTicketOpen'));
            assert.ok(ticketVerificationSource.includes('openTracked'));
        });

        it('[P1D-03] TicketVerificationView calls POST /api/claims/track-open with zero PII', () => {
            assert.ok(ticketVerificationSource.includes("api.post('/claims/track-open'"));
            assert.ok(ticketVerificationSource.includes('ticketToken: this.token'));
            assert.ok(ticketVerificationSource.includes('handoffId'));
            // Must not send sensitive fields or trust client bookingId
            assert.ok(!ticketVerificationSource.includes("bookingId: this.ticket?.bookingId"));
        });

        it('[P1E-01] Passenger Telegram CTA calls start-session forwarding handoffId', () => {
            assert.ok(ticketVerificationSource.includes("api.post('/claims/start-session'"));
            assert.ok(ticketVerificationSource.includes('const handoffId = this.$route.query.h || null'));
            assert.ok(ticketVerificationSource.includes('handoffId'));
        });
    });

});
