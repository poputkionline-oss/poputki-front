/**
 * ticket_module_ui.test.js — Frontend UI test suite for Ticket Module V1.1 (Pixel-Close Reference)
 * POPUTKI.ONLINE
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { generateQRCodeSVG } from '../src/utils/qrCode.js';

describe('TICKET MODULE V1.1 — FRONTEND UI TEST SUITE', () => {

    it('1. generateQRCodeSVG produces valid SVG markup containing viewBox and path elements', () => {
        const svg = generateQRCodeSVG('https://www.poputki.online/ticket/139-a9b8c7d6e5f4', 140);
        assert.ok(svg.startsWith('<svg'));
        assert.ok(svg.includes('viewBox="0 0 140 140"'));
        assert.ok(svg.includes('<rect width="140" height="140"'));
        assert.ok(svg.includes('<path d="M'));
        assert.ok(svg.endsWith('</svg>'));
    });

    it('2. generateQRCodeSVG handles empty input safely', () => {
        const svg = generateQRCodeSVG('', 140);
        assert.equal(svg, '');
    });

    it('3. PassengerTicket.vue reproduces reference double frame, header, and typography hierarchy', () => {
        const ticketVue = readFileSync(resolve('src/components/ticket/PassengerTicket.vue'), 'utf-8');
        assert.ok(ticketVue.includes('ticket-outer-frame'));
        assert.ok(ticketVue.includes('ticket-inner-box'));
        assert.ok(ticketVue.includes('POPUTKI.ONLINE'));
        assert.ok(ticketVue.includes('ПОЕЗДКИ С ДОВЕРИЕМ'));
        assert.ok(ticketVue.includes('ЭЛЕКТРОННЫЙ БИЛЕТ / МАРШРУТНЫЙ ЛИСТ'));
    });

    it('4. PassengerTicket.vue contains exact 3-column layout and bottom rules section', () => {
        const ticketVue = readFileSync(resolve('src/components/ticket/PassengerTicket.vue'), 'utf-8');
        assert.ok(ticketVue.includes('ДАННЫЕ ПОЕЗДКИ'));
        assert.ok(ticketVue.includes('ПАССАЖИР И МЕСТО'));
        assert.ok(ticketVue.includes('СЛУЖБА СОПРОВОЖДЕНИЯ'));
        assert.ok(ticketVue.includes('ПРАВИЛА И СЕРВИС В ПУТИ'));
        assert.ok(ticketVue.includes('POPUTKI.ONLINE — ВАШ НАДЁЖНЫЙ ПУТЬ.'));
        assert.ok(ticketVue.includes('ПРОСТО. УДОБНО. БЕЗОПАСНО.'));
        // Passport document field is strictly removed
        assert.ok(!ticketVue.includes('ПАСПОРТ (ЗАГРАН)'));
    });

    it('5. CarrierTripBookings.vue includes ticket preview and bulk print actions', () => {
        const bookingsVue = readFileSync(resolve('src/components/carrier/CarrierTripBookings.vue'), 'utf-8');
        assert.ok(bookingsVue.includes('PassengerTicket'));
        assert.ok(bookingsVue.includes('openTicketPreview'));
        assert.ok(bookingsVue.includes('openBulkPrint'));
        assert.ok(bookingsVue.includes('Распечатать билеты'));
        assert.ok(bookingsVue.includes('Билет'));
    });

    it('6. MyBusTicketsView.vue includes ticket view modal for passenger accounts', () => {
        const myTicketsVue = readFileSync(resolve('src/views/MyBusTicketsView.vue'), 'utf-8');
        assert.ok(myTicketsVue.includes('PassengerTicket'));
        assert.ok(myTicketsVue.includes('viewTicket'));
        assert.ok(myTicketsVue.includes('Электронный билет / Печать'));
    });

    it('7. router/index.js registers public ticket verification routes in publicRoutes allow-list', () => {
        const routerJs = readFileSync(resolve('src/router/index.js'), 'utf-8');
        assert.ok(routerJs.includes('/ticket/:token'));
        assert.ok(routerJs.includes('/ticket-verify/:token'));
        assert.ok(routerJs.includes('ticket-verification'));
        assert.ok(routerJs.includes('publicRoutes = ['));
    });

    it('8. TicketVerificationView.vue renders clean verification UI with verified status handling', () => {
        const verifyVue = readFileSync(resolve('src/views/TicketVerificationView.vue'), 'utf-8');
        assert.ok(verifyVue.includes('POPUTKI.ONLINE'));
        assert.ok(verifyVue.includes('ДЕЙСТВИТЕЛЕН'));
        assert.ok(verifyVue.includes('ОЖИДАЕТ ОПЛАТЫ'));
        assert.ok(verifyVue.includes('БИЛЕТ ОТМЕНЕН'));
        assert.ok(verifyVue.includes('ПОЕЗДКА ЗАВЕРШЕНА'));
    });
});
