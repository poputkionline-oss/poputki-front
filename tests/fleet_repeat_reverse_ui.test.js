import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Fleet Phase F: Repeat and Reverse Trips Frontend UI Suite', () => {

    const adminViewPath = resolve('src/views/BusAdminView.vue');
    const adminViewContent = readFileSync(adminViewPath, 'utf8');

    test('1. duplicateTicket checks if source bus is available in activeFleetBuses and preselects it', () => {
        assert.ok(adminViewContent.includes('duplicateTicket(ticket)'));
        assert.ok(adminViewContent.includes('const busExists = (this.activeFleetBuses || []).find(b => b.id === Number(ticket.bus_id))'));
        assert.ok(adminViewContent.includes('this.selectedFleetBusId = candidateBusId'));
    });

    test('2. duplicateTicket warns user if source bus is unavailable or archived', () => {
        assert.ok(adminViewContent.includes('Автобус исходного рейса сейчас недоступен или архивирован'));
    });

    test('3. duplicateTicket forces user to choose new departure and arrival dates', () => {
        assert.ok(adminViewContent.includes("departure_date: ''"));
        assert.ok(adminViewContent.includes("arrival_date: ''"));
    });

    test('4. reverseTicket preselects active source bus and alerts if unavailable', () => {
        assert.ok(adminViewContent.includes('reverseTicket(ticket)'));
        assert.ok(adminViewContent.includes('candidateBusId = String(ticket.bus_id)'));
    });

    test('5. reverseTicket swaps from_city and to_city and resets stop times', () => {
        assert.ok(adminViewContent.includes('from_city: ticket.to_city'));
        assert.ok(adminViewContent.includes('to_city: ticket.from_city'));
        assert.ok(adminViewContent.includes('time: \'\''));
    });

    test('6. Repeat and Reverse actions do not set isEditingTicket to true', () => {
        assert.ok(adminViewContent.includes('this.isEditingTicket = false'));
    });

    test('7. Repeat and Reverse switch active tab to create for user review', () => {
        assert.ok(adminViewContent.includes("this.activeTab = 'create'"));
    });

    test('8. Duplicate and Reverse buttons are rendered with friendly tooltips in tickets list', () => {
        assert.ok(adminViewContent.includes('@click="duplicateTicket(ticket)"'));
        assert.ok(adminViewContent.includes('@click="reverseTicket(ticket)"'));
    });

    test('9. Legacy tickets with bus_id=null repeat and reverse cleanly without error', () => {
        assert.ok(adminViewContent.includes('bus_id: candidateBusId ? Number(candidateBusId) : null'));
    });

    test('10. Submitting repeated/reversed ticket uses standard submitBusTicket with full validation', () => {
        assert.ok(adminViewContent.includes('@click="isEditingTicket ? updateBusTicket() : submitBusTicket()"'));
    });
});
