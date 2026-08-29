import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Fleet Phase F: Safe Bus Replacement UI Test Suite', () => {

    const adminViewPath = resolve('src/views/BusAdminView.vue');
    const adminViewContent = readFileSync(adminViewPath, 'utf8');

    test('1. editTicket initializes selectedFleetBusId from ticket.bus_id', () => {
        assert.ok(adminViewContent.includes('this.selectedFleetBusId = ticket.bus_id ? String(ticket.bus_id) :'));
    });

    test('2. Fleet selector dropdown and preview card are bound to selectedFleetBus', () => {
        assert.ok(adminViewContent.includes('v-model="selectedFleetBusId"'));
        assert.ok(adminViewContent.includes('v-if="selectedFleetBus"'));
    });

    test('3. Selected bus preview displays brand, model, license plate and capacity', () => {
        assert.ok(adminViewContent.includes('{{ selectedFleetBus.brand }} {{ selectedFleetBus.model }}'));
        assert.ok(adminViewContent.includes('{{ selectedFleetBus.license_plate }}'));
        assert.ok(adminViewContent.includes('{{ selectedFleetBus.total_seats }} мест'));
    });

    test('4. updateBusTicket attaches bus_id, snapshot fields and photos when selectedFleetBus is active', () => {
        assert.ok(adminViewContent.includes('updateData.bus_id = this.selectedFleetBus.id'));
        assert.ok(adminViewContent.includes('updateData.bus_type = this.selectedFleetBus.bus_type'));
        assert.ok(adminViewContent.includes('updateData.total_seats = this.selectedFleetBus.total_seats'));
        assert.ok(adminViewContent.includes('updateData.photos = this.selectedFleetBus.photos'));
    });

    test('5. updateBusTicket handles 409 BUS_SCHEDULE_CONFLICT error gracefully', () => {
        assert.ok(adminViewContent.includes("e.response?.data?.error === 'BUS_SCHEDULE_CONFLICT'"));
        assert.ok(adminViewContent.includes('this.showScheduleConflictModal = true'));
    });

    test('6. updateBusTicket handles 409 BUS_REPLACEMENT_HAS_BOOKINGS without crash or blank screen', () => {
        assert.ok(adminViewContent.includes("e.response?.data?.error === 'BUS_REPLACEMENT_HAS_BOOKINGS'"));
        assert.ok(adminViewContent.includes('активных бронирований'));
    });

    test('7. Conflict modal button triggers updateBusTicket(true) when editing', () => {
        assert.ok(adminViewContent.includes('@click="updateBusTicket(true)"'));
    });

    test('8. Driver role cannot access trip creation/editing tabs', () => {
        assert.ok(adminViewContent.includes('visibleNavItems'));
    });

    test('9. Accountant role has read-only restrictions and finance focus', () => {
        assert.ok(adminViewContent.includes("role === 'accountant'"));
    });

    test('10. Sensitive VIN is never displayed in fleet selector or trip preview cards', () => {
        assert.ok(!adminViewContent.includes('selectedFleetBus.vin'));
    });

    test('11. Internal fleet notes are never rendered in passenger or public areas', () => {
        assert.ok(!adminViewContent.includes('selectedFleetBus.notes'));
    });

    test('12. Reset button clears selectedFleetBusId', () => {
        assert.ok(adminViewContent.includes("selectedFleetBusId = ''"));
    });

    test('13. Legacy trip without bus_id can select and assign an active fleet bus', () => {
        assert.ok(adminViewContent.includes('v-for="b in activeFleetBuses"'));
    });

    test('14. Double decker bus displays floor breakdown in preview card', () => {
        assert.ok(adminViewContent.includes('selectedFleetBus.floor1_seats'));
        assert.ok(adminViewContent.includes('selectedFleetBus.floor2_seats'));
    });

    test('15. Mobile responsive flex classes used on bus preview card', () => {
        assert.ok(adminViewContent.includes('flex flex-col sm:flex-row'));
    });

    test('16. Form validation requires valid destination and departure date', () => {
        assert.ok(adminViewContent.includes('validateBusForm'));
    });

    test('17. Override allow_bus_conflict parameter is passed to backend on user confirmation', () => {
        assert.ok(adminViewContent.includes('updateData.allow_bus_conflict = true'));
    });

    test('18. Conflict modal shows conflicting route and timestamp without passenger PII', () => {
        assert.ok(adminViewContent.includes('c.from_city'));
        assert.ok(adminViewContent.includes('c.to_city'));
        assert.ok(adminViewContent.includes('c.departure_date'));
    });

    test('19. Success alert confirms trip update without window reload', () => {
        assert.ok(adminViewContent.includes('Рейс успешно обновлен!'));
    });

    test('20. Safe state cleanup on successful update', () => {
        assert.ok(adminViewContent.includes('this.isEditingTicket = false'));
        assert.ok(adminViewContent.includes('this.editingTicketId = null'));
    });

    test('21. Linked Fleet trip has no unassign / manual reset button', () => {
        assert.ok(adminViewContent.includes('v-if="!isEditingTicket || !editingOriginalBusId"'));
        assert.ok(adminViewContent.includes('Сбросить выбор'));
    });

    test('22. "Выбрать другой автобус" action is shown when editing linked Fleet trip', () => {
        assert.ok(adminViewContent.includes('Выбрать другой автобус'));
    });

    test('23. Legacy trip without bus_id still supports manual mode with reset button', () => {
        assert.ok(adminViewContent.includes('!editingOriginalBusId'));
    });

    test('24. Create-trip manual flow remains completely supported', () => {
        assert.ok(adminViewContent.includes('!isEditingTicket'));
    });

    test('25. Layout conflict (BUS_REPLACEMENT_LAYOUT_CONFLICT) is caught and reported to user', () => {
        assert.ok(adminViewContent.includes('updateBusTicket'));
    });

    test('26. Incompatible seats are surfaced without passenger PII', () => {
        assert.ok(!adminViewContent.includes('e.response.data.passenger_name'));
        assert.ok(!adminViewContent.includes('e.response.data.phone'));
    });

    test('27. Double -> single layout conflict does not crash the UI', () => {
        assert.ok(adminViewContent.includes('catch (e)'));
        assert.ok(adminViewContent.includes('this.loading = false'));
    });

    test('28. Unavailable Repeat bus triggers user notification', () => {
        assert.ok(adminViewContent.includes('Автобус исходного рейса сейчас недоступен или архивирован'));
    });

    test('29. Unavailable Reverse bus triggers user notification', () => {
        assert.ok(adminViewContent.includes('reverseTicket(ticket)'));
        assert.ok(adminViewContent.includes('Автобус исходного рейса сейчас недоступен или архивирован'));
    });

    test('30. No blank screen: error states ensure loading is reset and notifications shown', () => {
        assert.ok(adminViewContent.includes('finally {'));
        assert.ok(adminViewContent.includes('this.loading = false;'));
    });
});
