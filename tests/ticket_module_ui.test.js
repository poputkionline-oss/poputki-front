/**
 * ticket_module_ui.test.js — Frontend UI test suite for Ticket Module V1
 * POPUTKI.ONLINE
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { generateQRCodeSVG } from '../src/utils/qrCode.js';

describe('TICKET MODULE V1 — FRONTEND UI TEST SUITE', () => {

    it('1. generateQRCodeSVG produces valid SVG markup containing viewBox and path elements', () => {
        const svg = generateQRCodeSVG('https://www.poputki.online/ticket/139-a9b8c7d6e5f4', 160);
        assert.ok(svg.startsWith('<svg'));
        assert.ok(svg.includes('viewBox="0 0 160 160"'));
        assert.ok(svg.includes('<rect width="160" height="160"'));
        assert.ok(svg.includes('<path d="M'));
        assert.ok(svg.endsWith('</svg>'));
    });

    it('2. generateQRCodeSVG handles empty input safely', () => {
        const svg = generateQRCodeSVG('', 160);
        assert.equal(svg, '');
    });

    it('3. PassengerTicket.vue contains POPUTKI.ONLINE branding and print stylesheet', () => {
        const ticketVue = readFileSync(resolve('src/components/ticket/PassengerTicket.vue'), 'utf-8');
        assert.ok(ticketVue.includes('POPUTKI.ONLINE'));
        assert.ok(ticketVue.includes('Электронный билет'));
        assert.ok(ticketVue.includes('@media print'));
        assert.ok(ticketVue.includes('page-break-inside: avoid'));
    });

    it('4. CarrierTripBookings.vue includes ticket preview and bulk print actions', () => {
        const bookingsVue = readFileSync(resolve('src/components/carrier/CarrierTripBookings.vue'), 'utf-8');
        assert.ok(bookingsVue.includes('PassengerTicket'));
        assert.ok(bookingsVue.includes('openTicketPreview'));
        assert.ok(bookingsVue.includes('openBulkPrint'));
        assert.ok(bookingsVue.includes('Распечатать билеты'));
        assert.ok(bookingsVue.includes('Билет'));
    });

    it('5. MyBusTicketsView.vue includes ticket view modal for passenger accounts', () => {
        const myTicketsVue = readFileSync(resolve('src/views/MyBusTicketsView.vue'), 'utf-8');
        assert.ok(myTicketsVue.includes('PassengerTicket'));
        assert.ok(myTicketsVue.includes('viewTicket'));
        assert.ok(myTicketsVue.includes('Электронный билет / Печать'));
    });

    it('6. router/index.js registers public ticket verification routes in publicRoutes allow-list', () => {
        const routerJs = readFileSync(resolve('src/router/index.js'), 'utf-8');
        assert.ok(routerJs.includes('/ticket/:token'));
        assert.ok(routerJs.includes('/ticket-verify/:token'));
        assert.ok(routerJs.includes('ticket-verification'));
        assert.ok(routerJs.includes('publicRoutes = ['));
    });

    it('7. TicketVerificationView.vue renders clean verification UI with verified status handling', () => {
        const verifyVue = readFileSync(resolve('src/views/TicketVerificationView.vue'), 'utf-8');
        assert.ok(verifyVue.includes('POPUTKI.ONLINE'));
        assert.ok(verifyVue.includes('ДЕЙСТВИТЕЛЕН'));
        assert.ok(verifyVue.includes('ОЖИДАЕТ ОПЛАТЫ'));
        assert.ok(verifyVue.includes('БИЛЕТ ОТМЕНЕН'));
        assert.ok(verifyVue.includes('ПОЕЗДКА ЗАВЕРШЕНА'));
    });
});
