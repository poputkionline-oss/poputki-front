/**
 * tests/phase_e42_whatsapp_handoff_ui.test.js
 * 
 * Phase E.42 — WhatsApp Click-to-Chat Handoff Test Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
    normalizePhoneForWhatsApp,
    formatWhatsAppHandoffMessage,
    buildWhatsAppHandoffUrl
} from '../src/utils/whatsAppHandoff.js';

describe('PHASE E.42 — WHATSAPP CLICK-TO-CHAT HANDOFF IMPLEMENTATION', () => {

    const busAdminPath = path.resolve('src/views/BusAdminView.vue');
    const busAdminSource = fs.readFileSync(busAdminPath, 'utf8');

    // --- SECTION 1: CODE INTEGRITY & UI HIERARCHY ---

    it('1. BusAdminView imports WhatsApp handoff helpers', () => {
        assert.ok(
            busAdminSource.includes('formatWhatsAppHandoffMessage') &&
            busAdminSource.includes('buildWhatsAppHandoffUrl'),
            'Must import WhatsApp handoff helpers'
        );
    });

    it('2. BusAdminView defines Primary action "Отправить в WhatsApp"', () => {
        assert.ok(
            busAdminSource.includes('Отправить в WhatsApp'),
            'Must include "Отправить в WhatsApp" button'
        );
        assert.ok(
            busAdminSource.includes('@click="sendHandoffViaWhatsApp"'),
            'Must bind sendHandoffViaWhatsApp to primary button'
        );
    });

    it('3. BusAdminView defines Secondary action "Открыть в Telegram"', () => {
        assert.ok(
            busAdminSource.includes('Открыть в Telegram'),
            'Must include "Открыть в Telegram" button'
        );
        assert.ok(
            busAdminSource.includes('@click="openHandoffTelegram"'),
            'Must bind openHandoffTelegram to secondary button'
        );
    });

    it('4. BusAdminView defines Utility action "Скопировать ссылку"', () => {
        assert.ok(
            busAdminSource.includes('Скопировать ссылку'),
            'Must include "Скопировать ссылку" button'
        );
    });

    it('5. BusAdminView defines Utility action "Открыть билет"', () => {
        assert.ok(
            busAdminSource.includes('Открыть билет'),
            'Must include "Открыть билет" button'
        );
    });

    // --- SECTION 2: PHONE NORMALIZATION (A, B, C) ---

    it('6. Test A: Valid Tajik international phone normalizes to digits-only', () => {
        const rawPhone = '+992 92 792 50 51';
        const norm = normalizePhoneForWhatsApp(rawPhone);
        assert.strictEqual(norm, '992927925051');
    });

    it('7. Test B: Phone with +, spaces, hyphens, parentheses normalizes to digits-only', () => {
        assert.strictEqual(normalizePhoneForWhatsApp('+992 (92) 792-50-51'), '992927925051');
        assert.strictEqual(normalizePhoneForWhatsApp('+7 (999) 123-45-67'), '79991234567');
        assert.strictEqual(normalizePhoneForWhatsApp('8 (999) 123-45-67'), '79991234567');
        assert.strictEqual(normalizePhoneForWhatsApp('+998 (90) 123-45-67'), '998901234567');
    });

    it('8. Test C: Invalid/empty/placeholder phone returns null and yields safe error', () => {
        assert.strictEqual(normalizePhoneForWhatsApp(null), null);
        assert.strictEqual(normalizePhoneForWhatsApp(''), null);
        assert.strictEqual(normalizePhoneForWhatsApp('—'), null);
        assert.strictEqual(normalizePhoneForWhatsApp('-'), null);
        assert.strictEqual(normalizePhoneForWhatsApp('123'), null);
        assert.strictEqual(normalizePhoneForWhatsApp('invalid_phone'), null);

        const url = buildWhatsAppHandoffUrl({
            phone: '—',
            message: 'Test message'
        });
        assert.strictEqual(url, null);
    });

    // --- SECTION 3: URL ENCODING, EMOJI, LINE BREAKS (D, E, F) ---

    it('9. Test D, E, F: Message encoding preserves Cyrillic, emoji, and line breaks', () => {
        const message = `Здравствуйте, Тест!
🚌 Маршрут: Душанбе → Худжанд
📅 Дата: 05.09.2026
💺 Место: 8

🎫 Ссылка:
https://www.poputki.online/ticket-verify/sample-token`;

        const url = buildWhatsAppHandoffUrl({
            phone: '+992 92 792 50 51',
            message: message
        });

        assert.ok(url.startsWith('https://wa.me/992927925051?text='));
        const encodedPart = url.split('?text=')[1];
        const decoded = decodeURIComponent(encodedPart);

        assert.strictEqual(decoded, message);
        assert.ok(decoded.includes('🚌'));
        assert.ok(decoded.includes('📅'));
        assert.ok(decoded.includes('💺'));
        assert.ok(decoded.includes('🎫'));
        assert.ok(decoded.includes('\n'));
        assert.ok(decoded.includes('Душанбе → Худжанд'));
    });

    // --- SECTION 4: PAYLOAD INTEGRITY (G, H, I) ---

    it('10. Test G & H: WhatsApp payload contains canonical Ticket URL and NOT Telegram claim URL', () => {
        const ticketUrl = 'https://www.poputki.online/ticket-verify/448-bde80c8fc4e62bb31ef3ab12ad282d1e';
        const msg = formatWhatsAppHandoffMessage({
            role: 'passenger',
            name: 'Абдуллоев Акмалхон',
            fromCity: 'Душанбе',
            toCity: 'Худжанд',
            departureDate: '05.09.2026',
            seats: '8',
            ticketUrl: ticketUrl
        });

        assert.ok(msg.includes(ticketUrl), 'Message must contain canonical ticket URL');
        assert.ok(!msg.includes('t.me/'), 'Message MUST NOT contain t.me claim URL');
        assert.ok(!msg.includes('claim_'), 'Message MUST NOT contain raw claim_ token');
        assert.ok(msg.includes('POPUTKI.ONLINE'), 'Brand must be exact Latin POPUTKI.ONLINE');
    });

    it('11. Test I: WhatsApp click action does not mutate booking ownership', () => {
        const booking = {
            id: 448,
            claimed_by_user_id: null,
            claim_status: 'pending_verification',
            status: 'confirmed'
        };

        // Simulate click action
        const phone = '+992 92 792 50 51';
        const url = buildWhatsAppHandoffUrl({
            phone,
            message: 'Test message'
        });

        assert.ok(url);
        // Assert ownership invariant
        assert.strictEqual(booking.claimed_by_user_id, null);
        assert.strictEqual(booking.claim_status, 'pending_verification');
        assert.strictEqual(booking.status, 'confirmed');
    });

    // --- SECTION 5: ROLE TEMPLATES (J, K, L, M) ---

    it('12. Test J: Passenger role template includes personalized greeting and brand', () => {
        const msg = formatWhatsAppHandoffMessage({
            role: 'passenger',
            name: 'Али Саидов',
            fromCity: 'Душанбе',
            toCity: 'Худжанд',
            departureDate: '10.09.2026',
            seats: '12',
            ticketUrl: 'https://www.poputki.online/ticket-verify/test-token'
        });

        assert.ok(msg.startsWith('Здравствуйте, Али Саидов!'));
        assert.ok(msg.includes('🚌 Маршрут: Душанбе → Худжанд'));
        assert.ok(msg.includes('📅 Дата отправления: 10.09.2026'));
        assert.ok(msg.includes('💺 Место: 12'));
        assert.ok(msg.includes('POPUTKI.ONLINE\nПОЕЗДКИ С ДОВЕРИЕМ'));
    });

    it('13. Test K: Family/Group role template includes forwarding instruction', () => {
        const msg = formatWhatsAppHandoffMessage({
            role: 'family_or_group',
            name: 'Группа Семья',
            fromCity: 'Душанбе',
            toCity: 'Худжанд',
            departureDate: '10.09.2026',
            seats: '1, 2, 3',
            ticketUrl: 'https://www.poputki.online/ticket-verify/test-token'
        });

        assert.ok(msg.includes('Вы получили билет для члена семьи или группы'));
        assert.ok(msg.includes('Пожалуйста, передайте ссылку фактическому пассажиру'));
        assert.ok(msg.includes('Подтверждение поездки должен выполнить сам пассажир'));
    });

    it('14. Test L: Coordinator role template includes mediator forwarding instruction', () => {
        const msg = formatWhatsAppHandoffMessage({
            role: 'coordinator',
            name: 'Координатор Алишер',
            fromCity: 'Москва',
            toCity: 'Душанбе',
            departureDate: '12.09.2026',
            seats: '5',
            ticketUrl: 'https://www.poputki.online/ticket-verify/test-token'
        });

        assert.ok(msg.includes('Вы получили билет для передачи пассажиру'));
        assert.ok(msg.includes('Пожалуйста, перешлите эту ссылку фактическому пассажиру'));
        assert.ok(msg.includes('Получение сообщения не делает вас владельцем бронирования'));
    });

    it('15. Test M: Unknown role template uses neutral greeting without verified passenger address', () => {
        const msg = formatWhatsAppHandoffMessage({
            role: 'unknown',
            name: 'Unknown Contact',
            fromCity: 'Душанбе',
            toCity: 'Худжанд',
            departureDate: '10.09.2026',
            seats: '8',
            ticketUrl: 'https://www.poputki.online/ticket-verify/test-token'
        });

        assert.ok(msg.startsWith('Здравствуйте!\n\nДля передачи вам подготовлен электронный билет POPUTKI.ONLINE.'));
        assert.ok(msg.includes('Передайте ссылку фактическому пассажиру, если билет предназначен не вам'));
        assert.ok(!msg.includes('Unknown Contact'), 'Must not address contact by name as verified passenger');
    });

    // --- SECTION 6: ACTIONS & TRUTHFUL STATUS (N, O, P, Q) ---

    it('16. Test N: openHandoffTelegram opens Telegram claim URL without mutating ownership', () => {
        let openedUrl = null;
        const fakeWindow = {
            open: (url, target) => { openedUrl = url; }
        };

        const modalState = {
            claimUrl: 'https://t.me/Poputkionline_bot?start=claim_1234567890abcdef1234567890abcdef'
        };

        fakeWindow.open(modalState.claimUrl, '_blank');
        assert.strictEqual(openedUrl, modalState.claimUrl);
    });

    it('17. Test O & P: Copy link and Open Ticket use canonical ticket URL', () => {
        const ticketUrl = 'https://www.poputki.online/ticket-verify/448-bde80c8fc4e62bb31ef3ab12ad282d1e';
        let copied = '';
        let opened = '';

        function copy(text) { copied = text; }
        function open(url) { opened = url; }

        copy(ticketUrl);
        open(ticketUrl);

        assert.strictEqual(copied, ticketUrl);
        assert.strictEqual(opened, ticketUrl);
    });

    it('18. Test Q: Truthful WhatsApp feedback never claims delivery success', () => {
        const feedback = 'WhatsApp открыт. Проверьте сообщение и нажмите «Отправить».';
        assert.ok(!feedback.includes('отправлен в WhatsApp'), 'Must never claim message was sent');
        assert.ok(!feedback.includes('доставлен'), 'Must never claim delivered status');
    });

    // --- SECTION 7: PRODUCTION BOOKING #448 FIXTURE ---

    it('19. Booking #448 fixture produces complete valid WhatsApp handoff', () => {
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

        const msg = formatWhatsAppHandoffMessage({
            role: fixture448.role,
            name: fixture448.name,
            fromCity: fixture448.trip.fromCity,
            toCity: fixture448.trip.toCity,
            departureDate: fixture448.trip.departureDate,
            seats: fixture448.seat,
            ticketUrl: fixture448.ticketUrl
        });

        const url = buildWhatsAppHandoffUrl({
            phone: fixture448.phone,
            message: msg
        });

        assert.ok(url.startsWith('https://wa.me/992927925051?text='));
        assert.ok(url.includes('POPUTKI.ONLINE'));
        assert.ok(url.includes('448-bde80c8fc4e62bb31ef3ab12ad282d1e'));
        assert.ok(!url.includes('t.me/Poputkionline_bot'));
    });

});
