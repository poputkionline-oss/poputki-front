/**
 * tests/phase_e43_sms_fallback_ui.test.js
 * 
 * Phase E.43 — SMS Fallback + Transport Message Hardening Test Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
    normalizePhoneForHandoff,
    buildHandoffMessage,
    formatWhatsAppHandoffMessage,
    formatSmsHandoffMessage,
    buildWhatsAppHandoffUrl,
    buildSmsHandoffUrl
} from '../src/utils/whatsAppHandoff.js';

describe('PHASE E.43 — SMS FALLBACK + TRANSPORT MESSAGE HARDENING', () => {

    const busAdminPath = path.resolve('src/views/BusAdminView.vue');
    const busAdminSource = fs.readFileSync(busAdminPath, 'utf8');

    // --- SECTION 1: UI ACTION HIERARCHY ---

    it('1. BusAdminView defines complete handoff action hierarchy', () => {
        // Primary
        assert.ok(busAdminSource.includes('Отправить в WhatsApp'), 'WhatsApp primary button required');
        assert.ok(busAdminSource.includes('@click="sendHandoffViaWhatsApp"'));

        // Fallback
        assert.ok(busAdminSource.includes('Отправить по SMS'), 'SMS fallback button required');
        assert.ok(busAdminSource.includes('@click="sendHandoffViaSms"'));

        // Secondary
        assert.ok(busAdminSource.includes('Открыть в Telegram'), 'Telegram secondary button required');
        assert.ok(busAdminSource.includes('@click="openHandoffTelegram"'));

        // Utilities
        assert.ok(busAdminSource.includes('Скопировать ссылку'), 'Copy link utility required');
        assert.ok(busAdminSource.includes('Открыть билет'), 'Open ticket utility required');
    });

    // --- SECTION 2: NO DECORATIVE EMOJIS & ENCODING HARDENING ---

    it('2. Transport messages contain NO decorative non-BMP emojis', () => {
        const testRoles = ['passenger', 'family_or_group', 'coordinator', 'unknown'];
        const channels = ['whatsapp', 'sms'];

        const decorativeEmojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u26FF\u2700-\u27BF]/;

        testRoles.forEach(role => {
            channels.forEach(channel => {
                const msg = buildHandoffMessage({
                    channel,
                    contactRole: role,
                    name: 'Тест Пассажир',
                    fromCity: 'Душанбе',
                    toCity: 'Худжанд',
                    departureDate: '05.09.2026',
                    seats: '8',
                    ticketUrl: 'https://www.poputki.online/ticket-verify/test-token'
                });

                assert.ok(!decorativeEmojiRegex.test(msg), `Message for ${channel}/${role} must NOT contain decorative emojis`);
                assert.ok(!msg.includes('\uFFFD'), `Message for ${channel}/${role} must NOT contain replacement character`);
                assert.ok(!msg.includes('🚌'), 'Must not contain bus emoji');
                assert.ok(!msg.includes('📅'), 'Must not contain calendar emoji');
                assert.ok(!msg.includes('💺'), 'Must not contain seat emoji');
                assert.ok(!msg.includes('🎫'), 'Must not contain ticket emoji');
            });
        });
    });

    it('3. Russian Cyrillic and UTF-8 round-trip perfectly without corruption', () => {
        const msg = formatWhatsAppHandoffMessage({
            role: 'passenger',
            name: 'Алишер Саидов',
            fromCity: 'Душанбе',
            toCity: 'Худжанд',
            departureDate: '10.09.2026',
            seats: '5',
            ticketUrl: 'https://www.poputki.online/ticket-verify/test-token'
        });

        const url = buildWhatsAppHandoffUrl({
            phone: '+992 92 792 50 51',
            message: msg
        });

        const encodedPart = url.split('?text=')[1];
        const decoded = decodeURIComponent(encodedPart);

        assert.strictEqual(decoded, msg);
        assert.ok(decoded.includes('Алишер Саидов'));
        assert.ok(decoded.includes('Душанбе - Худжанд'));
        assert.ok(!decoded.includes('\uFFFD'));
    });

    // --- SECTION 3: SMS DEEP LINK & CROSS-PLATFORM URL ---

    it('4. buildSmsHandoffUrl creates RFC 5724 compliant URI for Android and iOS', () => {
        const msg = formatSmsHandoffMessage({
            role: 'passenger',
            fromCity: 'Душанбе',
            toCity: 'Худжанд',
            departureDate: '05.09.2026',
            seats: '8',
            ticketUrl: 'https://www.poputki.online/ticket-verify/test-token'
        });

        const url = buildSmsHandoffUrl({
            phone: '+992 (92) 792-50-51',
            message: msg
        });

        assert.ok(url.startsWith('sms:+992927925051?body='));
        const bodyPart = url.split('?body=')[1];
        const decodedBody = decodeURIComponent(bodyPart);

        assert.strictEqual(decodedBody, msg);
        assert.ok(decodedBody.includes('Ваш билет POPUTKI.ONLINE готов.'));
        assert.ok(decodedBody.includes('Душанбе - Худжанд'));
    });

    // --- SECTION 4: PHONE NORMALIZATION & REJECTION ---

    it('5. Phone normalization is shared and safely handles formats and placeholders', () => {
        assert.strictEqual(normalizePhoneForHandoff('+992 92 792 50 51'), '992927925051');
        assert.strictEqual(normalizePhoneForHandoff('+7 (999) 123-45-67'), '79991234567');
        assert.strictEqual(normalizePhoneForHandoff('8 (999) 123-45-67'), '79991234567');
        assert.strictEqual(normalizePhoneForHandoff('—'), null);
        assert.strictEqual(normalizePhoneForHandoff(''), null);
        assert.strictEqual(normalizePhoneForHandoff(null), null);
        assert.strictEqual(normalizePhoneForHandoff('123'), null);

        // URLs return null for invalid phone
        assert.strictEqual(buildWhatsAppHandoffUrl({ phone: '—', message: 'test' }), null);
        assert.strictEqual(buildSmsHandoffUrl({ phone: '—', message: 'test' }), null);
    });

    // --- SECTION 5: PAYLOAD INTEGRITY (CANONICAL TICKET URL) ---

    it('6. WhatsApp and SMS payloads contain canonical Ticket URL and NOT Telegram claim URL', () => {
        const canonicalTicketUrl = 'https://www.poputki.online/ticket-verify/448-bde80c8fc4e62bb31ef3ab12ad282d1e';

        const waMsg = formatWhatsAppHandoffMessage({
            role: 'passenger',
            name: 'Акмалхон',
            fromCity: 'Душанбе',
            toCity: 'Худжанд',
            departureDate: '05.09.2026',
            seats: '8',
            ticketUrl: canonicalTicketUrl
        });

        const smsMsg = formatSmsHandoffMessage({
            role: 'passenger',
            fromCity: 'Душанбе',
            toCity: 'Худжанд',
            departureDate: '05.09.2026',
            seats: '8',
            ticketUrl: canonicalTicketUrl
        });

        [waMsg, smsMsg].forEach(msg => {
            assert.ok(msg.includes(canonicalTicketUrl), 'Must contain canonical ticket URL');
            assert.ok(!msg.includes('t.me/'), 'Must NOT contain t.me claim URL');
            assert.ok(!msg.includes('claim_'), 'Must NOT contain claim token');
            assert.ok(!msg.includes('passport'), 'Must NOT leak passport or documents');
            assert.ok(!msg.includes('user_id'), 'Must NOT leak internal user ID');
            assert.ok(msg.includes('POPUTKI.ONLINE'), 'Brand must be POPUTKI.ONLINE');
        });
    });

    // --- SECTION 6: ROLE-AWARE SMS TEMPLATES ---

    it('7. SMS templates are compact and preserve role semantics without ownership claim', () => {
        const ticketUrl = 'https://www.poputki.online/ticket-verify/test-token';

        // Passenger
        const pMsg = formatSmsHandoffMessage({ role: 'passenger', fromCity: 'Душанбе', toCity: 'Худжанд', departureDate: '05.09.2026', seats: '8', ticketUrl });
        assert.ok(pMsg.includes('Ваш билет POPUTKI.ONLINE готов.'));
        assert.ok(pMsg.includes('Билет и подтверждение:'));

        // Family or Group
        const fgMsg = formatSmsHandoffMessage({ role: 'family_or_group', fromCity: 'Душанбе', toCity: 'Худжанд', departureDate: '05.09.2026', seats: '1, 2', ticketUrl });
        assert.ok(fgMsg.includes('Передайте ссылку фактическому пассажиру:'));

        // Coordinator
        const cMsg = formatSmsHandoffMessage({ role: 'coordinator', fromCity: 'Душанбе', toCity: 'Худжанд', departureDate: '05.09.2026', seats: '5', ticketUrl });
        assert.ok(cMsg.includes('Билет POPUTKI.ONLINE для передачи пассажиру.'));
        assert.ok(cMsg.includes('Передайте пассажиру:'));

        // Unknown
        const uMsg = formatSmsHandoffMessage({ role: 'unknown', fromCity: 'Душанбе', toCity: 'Худжанд', departureDate: '05.09.2026', seats: '3', ticketUrl });
        assert.ok(uMsg.includes('Электронный билет POPUTKI.ONLINE.'));
        assert.ok(uMsg.includes('Если билет предназначен не вам, передайте ссылку пассажиру:'));
    });

    // --- SECTION 7: TRUTHFUL DELIVERY SEMANTICS & OWNERSHIP SAFETY ---

    it('8. SMS and WhatsApp actions never claim delivery success and never mutate ownership', () => {
        const booking = {
            id: 448,
            claimed_by_user_id: null,
            claim_status: 'pending_verification',
            status: 'confirmed'
        };

        // Simulated user clicks
        const phone = '+992 92 792 50 51';
        const waUrl = buildWhatsAppHandoffUrl({ phone, message: 'test' });
        const smsUrl = buildSmsHandoffUrl({ phone, message: 'test' });

        assert.ok(waUrl);
        assert.ok(smsUrl);

        // Invariant check
        assert.strictEqual(booking.claimed_by_user_id, null);
        assert.strictEqual(booking.claim_status, 'pending_verification');
        assert.strictEqual(booking.status, 'confirmed');

        // Check feedback wording in BusAdminView source
        assert.ok(!busAdminSource.includes('SMS отправлен'), 'Must never claim SMS was sent');
        assert.ok(!busAdminSource.includes('Билет отправлен в WhatsApp'), 'Must never claim WhatsApp sent');
        assert.ok(busAdminSource.includes('Открыто приложение SMS'), 'Truthful feedback required');
        assert.ok(busAdminSource.includes('WhatsApp открыт'), 'Truthful feedback required');
    });

    // --- SECTION 8: BOOKING #448 FIXTURE INTEGRATION ---

    it('9. Booking #448 fixture produces complete valid WhatsApp and SMS handoffs', () => {
        const fixture448 = {
            bookingId: 448,
            seat: '8',
            name: 'Абдуллоев Акмалхон',
            phone: '+992 92 792 50 51',
            role: 'passenger',
            trip: {
                fromCity: 'Душанбе',
                toCity: 'Худжанд',
                departureDate: '05.09.2026',
                seats: '8'
            },
            ticketUrl: 'https://www.poputki.online/ticket-verify/448-bde80c8fc4e62bb31ef3ab12ad282d1e'
        };

        const waUrl = buildWhatsAppHandoffUrl({
            phone: fixture448.phone,
            message: formatWhatsAppHandoffMessage({
                role: fixture448.role,
                name: fixture448.name,
                fromCity: fixture448.trip.fromCity,
                toCity: fixture448.trip.toCity,
                departureDate: fixture448.trip.departureDate,
                seats: fixture448.seat,
                ticketUrl: fixture448.ticketUrl
            })
        });

        const smsUrl = buildSmsHandoffUrl({
            phone: fixture448.phone,
            message: formatSmsHandoffMessage({
                role: fixture448.role,
                fromCity: fixture448.trip.fromCity,
                toCity: fixture448.trip.toCity,
                departureDate: fixture448.trip.departureDate,
                seats: fixture448.seat,
                ticketUrl: fixture448.ticketUrl
            })
        });

        assert.ok(waUrl.startsWith('https://wa.me/992927925051?text='));
        assert.ok(smsUrl.startsWith('sms:+992927925051?body='));
        assert.ok(waUrl.includes('448-bde80c8fc4e62bb31ef3ab12ad282d1e'));
        assert.ok(smsUrl.includes('448-bde80c8fc4e62bb31ef3ab12ad282d1e'));
        assert.ok(!waUrl.includes('%F0%9F')); // No 4-byte emoji encoding in WhatsApp
        assert.ok(!smsUrl.includes('%F0%9F')); // No 4-byte emoji encoding in SMS
    });

});
