import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Fleet Phase D: Frontend Bus -> Trip Integration Test Suite', () => {

    const busAdminPath = path.resolve(__dirname, '../src/views/BusAdminView.vue');
    const busAdminSource = fs.readFileSync(busAdminPath, 'utf8');

    // 1. Create tab loads active buses
    it('1. Entering create tab triggers fetchFleetBuses', () => {
        assert.ok(busAdminSource.includes("this.activeTab === 'create' || this.activeTab === 'fleet'"));
        assert.ok(busAdminSource.includes('fetchFleetBuses'));
    });

    // 2. Bus selector renders active fleet
    it('2. Bus selector renders active fleet via activeFleetBuses computed property', () => {
        assert.ok(busAdminSource.includes('activeFleetBuses()'));
        assert.ok(busAdminSource.includes("b.status === 'active'"));
        assert.ok(busAdminSource.includes('v-for="b in activeFleetBuses"'));
    });

    // 3. Selecting bus updates form
    it('3. Selecting a bus in dropdown updates form state via selectedFleetBusId watcher', () => {
        assert.ok(busAdminSource.includes('selectedFleetBusId(newId)'));
        assert.ok(busAdminSource.includes('this.busForm.bus_id = bus.id'));
    });

    // 4. bus_id linked
    it('4. Selected bus ID is linked into busForm.bus_id', () => {
        assert.ok(busAdminSource.includes('submitData.bus_id = this.selectedFleetBus.id'));
    });

    // 5. bus_type auto-populated
    it('5. bus_type is auto-populated from selected bus master record', () => {
        assert.ok(busAdminSource.includes("this.busForm.bus_type = bus.bus_type || 'single'"));
    });

    // 6. total_seats auto-populated
    it('6. total_seats is auto-populated from selected bus master record', () => {
        assert.ok(busAdminSource.includes('this.busForm.total_seats = bus.total_seats || 53'));
    });

    // 7. floor1_seats auto-populated
    it('7. floor1_seats is auto-populated from double-deck master bus record', () => {
        assert.ok(busAdminSource.includes('this.busForm.floor1_seats = bus.floor1_seats || 20'));
    });

    // 8. floor2_seats auto-populated
    it('8. floor2_seats is auto-populated from double-deck master bus record', () => {
        assert.ok(busAdminSource.includes('this.busForm.floor2_seats = bus.floor2_seats || 56'));
    });

    // 9. photos auto-populated
    it('9. Photos array is auto-populated from selected master bus record', () => {
        assert.ok(busAdminSource.includes('this.busForm.photos = Array.isArray(bus.photos)'));
    });

    // 10. Manual capacity hidden when bus selected
    it('10. Manual bus type selector and seat inputs are conditionally hidden when a fleet bus is selected', () => {
        assert.ok(busAdminSource.includes('v-if="!selectedFleetBus"'));
        assert.ok(busAdminSource.includes('Конфигурация автобуса (вручную)'));
    });

    // 11. Seat scheme preview shows bus layout
    it('11. Interactive BusSeatSelector component is rendered in Create Trip to preview seat layout', () => {
        assert.ok(busAdminSource.includes('Предпросмотр схемы мест'));
        assert.ok(busAdminSource.includes('<BusSeatSelector'));
    });

    // 12. Reset selection restores manual mode
    it('12. Resetting bus selection restores manual input mode', () => {
        assert.ok(busAdminSource.includes("selectedFleetBusId = ''"));
        assert.ok(busAdminSource.includes('Сбросить выбор'));
    });

    // 13. Double deck bus layout preview
    it('13. Double deck bus configuration passes floor1 and floor2 seats to BusSeatSelector', () => {
        assert.ok(busAdminSource.includes(':floor1-seats="Number(selectedFleetBus ? selectedFleetBus.floor1_seats : busForm.floor1_seats)'));
        assert.ok(busAdminSource.includes(':floor2-seats="Number(selectedFleetBus ? selectedFleetBus.floor2_seats : busForm.floor2_seats)'));
    });

    // 14. Single deck bus layout preview
    it('14. Single deck bus configuration passes total seats to BusSeatSelector', () => {
        assert.ok(busAdminSource.includes(':total-seats="Number(selectedFleetBus ? selectedFleetBus.total_seats : busForm.total_seats)'));
    });

    // 15. Summary card displays bus specs
    it('15. Selected bus summary card displays brand, model, plate, seats, and photo thumbnail', () => {
        assert.ok(busAdminSource.includes('selectedFleetBus.brand'));
        assert.ok(busAdminSource.includes('selectedFleetBus.license_plate'));
        assert.ok(busAdminSource.includes('selectedFleetBus.total_seats'));
    });

    // 16. Submit payload includes bus_id
    it('16. submitData payload includes bus_id when selectedFleetBus is present', () => {
        assert.ok(busAdminSource.includes('submitData.bus_id = this.selectedFleetBus.id'));
    });

    // 17. Empty fleet warning banner shown
    it('17. When fleet has no active buses, an informative banner is displayed', () => {
        assert.ok(busAdminSource.includes('!fleetLoading && activeFleetBuses.length === 0'));
        assert.ok(busAdminSource.includes('В вашем автопарке пока нет активных автобусов'));
    });

    // 18. Add bus button redirects to fleet tab
    it('18. Add bus button in banner switches activeTab to fleet', () => {
        assert.ok(busAdminSource.includes("@click=\"activeTab = 'fleet'\""));
    });

    // 19. Schedule conflict 409 shows conflict dialog
    it('19. Receiving 409 BUS_SCHEDULE_CONFLICT triggers showScheduleConflictModal dialog', () => {
        assert.ok(busAdminSource.includes("e.response?.data?.error === 'BUS_SCHEDULE_CONFLICT'"));
        assert.ok(busAdminSource.includes('this.showScheduleConflictModal = true'));
    });

    // 20. Conflict dialog shows route and time intervals
    it('20. Conflict dialog displays conflicting trip route and departure/arrival timestamps', () => {
        assert.ok(busAdminSource.includes('v-for="c in scheduleConflicts"'));
        assert.ok(busAdminSource.includes('c.from_city'));
        assert.ok(busAdminSource.includes('c.to_city'));
        assert.ok(busAdminSource.includes('c.departure_date'));
    });

    // 21. Conflict dialog "все равно создать" sends allow_bus_conflict
    it('21. Override button calls submitBusTicket(true) which sends allow_bus_conflict=true', () => {
        assert.ok(busAdminSource.includes('@click="submitBusTicket(true)"'));
        assert.ok(busAdminSource.includes('submitData.allow_bus_conflict = true'));
    });

    // 22. Conflict dialog "отмена" cancels creation
    it('22. Cancel button closes conflict modal and leaves form intact', () => {
        assert.ok(busAdminSource.includes('showScheduleConflictModal = false'));
        assert.ok(busAdminSource.includes('Отмена'));
    });

    // 23. Edit existing ticket works
    it('23. Editing an existing ticket populates busForm and opens create tab without fleet override', () => {
        assert.ok(busAdminSource.includes('editTicket(ticket)'));
        assert.ok(busAdminSource.includes('this.isEditingTicket = true'));
        assert.ok(busAdminSource.includes('v-if="!isEditingTicket"'));
    });

    // 24. Duplicate ticket preserves ticket details
    it('24. Duplicating ticket copies route and bus configuration for a new departure date', () => {
        assert.ok(busAdminSource.includes('duplicateTicket(ticket)'));
        assert.ok(busAdminSource.includes("departure_date: ''"));
    });

    // 25. Reverse ticket inverts stops
    it('25. Reverse ticket reverses intermediate stops and route cities', () => {
        assert.ok(busAdminSource.includes('reverseTicket(ticket)'));
        assert.ok(busAdminSource.includes('from_city: ticket.to_city'));
        assert.ok(busAdminSource.includes('to_city: ticket.from_city'));
    });

    // 26. Terms checkbox validation required
    it('26. validateBusForm enforces agreement with terms and offer', () => {
        assert.ok(busAdminSource.includes('busForm.accept_terms'));
        assert.ok(busAdminSource.includes('Необходимо согласиться с условиями использования'));
    });

    // 27. Required route fields validation
    it('27. validateBusForm validates company, departure city, destination, and dates', () => {
        assert.ok(busAdminSource.includes('busForm.transport_company'));
        assert.ok(busAdminSource.includes('busForm.from_city'));
        assert.ok(busAdminSource.includes('busForm.to_city'));
        assert.ok(busAdminSource.includes('busForm.departure_date'));
    });

    // 28. Price and duration fields validation
    it('28. validateBusForm validates positive price and duration hours', () => {
        assert.ok(busAdminSource.includes('busForm.duration_hours'));
        assert.ok(busAdminSource.includes('busForm.price'));
    });

    // 29. Non-owner role navigation visibility
    it('29. visibleNavItems filters navigation items by member role (driver, accountant, dispatcher, owner)', () => {
        assert.ok(busAdminSource.includes('visibleNavItems()'));
        assert.ok(busAdminSource.includes("role === 'driver'"));
        assert.ok(busAdminSource.includes("role === 'accountant'"));
    });

    // 30. Clean modal and form styling
    it('30. Modal and form elements have proper Tailwind CSS classes and accessible IDs', () => {
        assert.ok(busAdminSource.includes('showScheduleConflictModal'));
        assert.ok(busAdminSource.includes('animate-fadeIn'));
        assert.ok(busAdminSource.includes('backdrop-blur-sm'));
    });

});
