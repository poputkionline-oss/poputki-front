/**
 * tests/phase_p2_5_correlation_id_display.test.js
 *
 * PHASE P.2.5 — TRIP UPDATE 500 HARDENING + OBSERVABILITY (frontend half)
 *
 * The backend's outer catch on PUT /api/bus-admin/tickets/:id now returns
 * { error: 'SERVER_ERROR', message: 'Внутренняя ошибка сервера',
 *   correlation_id: '<uuid>' } for an unexpected exception, and still
 * returns its existing controlled bodies (409 BUS_SCHEDULE_CONFLICT /
 * BUS_SEAT_REMAP_REQUIRED / ROUTE_CHANGE_REQUIRES_SEPARATE_TRIP /
 * BUS_REPLACEMENT_HAS_BOOKINGS, 400 BUS_UNASSIGN_FORBIDDEN, 503 fail-closed)
 * for every other case, none of which carry a correlation_id.
 *
 * updateBusTicket()'s generic catch-all `else` branch (the only branch that
 * can ever see a correlation_id, since every earlier branch matches a
 * specific controlled error first) now appends
 * "\nКод ошибки: <correlation_id>" to the alert when the backend supplies
 * one — without touching any of the specific branches above it.
 *
 * This suite drives the REAL updateBusTicket() method (via the same
 * real-Vue-reactivity harness technique as
 * tests/phase_p2_2_edit_trip_initial_state.test.js), mocking only
 * window.alert and api.put — never reimplementing the branch logic itself.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { reactive, watch, nextTick } from 'vue';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vuePath = path.resolve(__dirname, '../src/views/BusAdminView.vue');

let mod;
let tempPath;

before(async () => {
    const src = fs.readFileSync(vuePath, 'utf8');
    const match = src.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(match, 'BusAdminView.vue must have a plain <script> block');

    const sanitized = match[1]
        .replace(/import api from '\.\.\/api';/, 'export const api = { get: async () => ({ data: [] }), put: async () => ({ data: { success: true } }) };')
        .replace(/import AppLogo from '\.\.\/components\/AppLogo\.vue';/, 'const AppLogo = {};')
        .replace(/import \{ exportPassengerManifestExcel, sortPassengersBySeat \} from '\.\.\/utils\/excelExport';/, 'const exportPassengerManifestExcel = () => {}, sortPassengersBySeat = () => {};')
        .replace(/import \{ compressImage \} from '\.\.\/utils\/imageCompression';/, 'const compressImage = () => {};')
        .replace(/import \{ uploadToCloudinaryDirect \} from '\.\.\/utils\/cloudinary';/, 'const uploadToCloudinaryDirect = () => {};')
        .replace(/import \{ copyToClipboard \} from '\.\.\/telegram';/, 'const copyToClipboard = () => {};')
        .replace(/import \{[\s\S]*?\} from '\.\.\/utils\/whatsAppHandoff';/, 'const formatWhatsAppHandoffMessage = () => {}, buildWhatsAppHandoffUrl = () => {}, formatSmsHandoffMessage = () => {}, buildSmsHandoffUrl = () => {}, buildTelegramShareUrl = () => {};')
        .replace(/import BusSeatSelector from '\.\.\/components\/BusSeatSelector\.vue';/, 'const BusSeatSelector = {};')
        .replace(/import CarrierBoarding from '\.\.\/components\/carrier\/CarrierBoarding\.vue';/, 'const CarrierBoarding = {};')
        .replace(/import CarrierTripBookings from '\.\.\/components\/carrier\/CarrierTripBookings\.vue';/, 'const CarrierTripBookings = {};')
        .replace(/import CarrierFinance from '\.\.\/components\/carrier\/CarrierFinance\.vue';/, 'const CarrierFinance = {};')
        .replace(/import CarrierMembers from '\.\.\/components\/carrier\/CarrierMembers\.vue';/, 'const CarrierMembers = {};')
        .replace(/import CarrierCustomers from '\.\.\/components\/carrier\/CarrierCustomers\.vue';/, 'const CarrierCustomers = {};')
        .replace(/import CarrierActivity from '\.\.\/components\/carrier\/CarrierActivity\.vue';/, 'const CarrierActivity = {};')
        .replace(/import CarrierDashboard from '\.\.\/components\/carrier\/CarrierDashboard\.vue';/, 'const CarrierDashboard = {};')
        .replace(/import CarrierFleet from '\.\.\/components\/carrier\/CarrierFleet\.vue';/, 'const CarrierFleet = {};')
        .replace(/import \{[\s\S]*?\} from 'chart\.js';/, '')
        .replace(/import \{ Line, Pie, Bar \} from 'vue-chartjs';/, 'const Line = {}, Pie = {}, Bar = {};')
        .replace(/ChartJS\.register\([\s\S]*?\);/, '');

    assert.ok(!/from ['"].*\.vue['"]/.test(sanitized), 'a .vue import survived sanitization');
    assert.ok(!/^import /m.test(sanitized), 'an unsanitized import statement survived sanitization');

    tempPath = vuePath.replace(/\.vue$/, `.__p2_5_test_${process.pid}_${Date.now()}.mjs`);
    fs.writeFileSync(tempPath, sanitized, 'utf8');
    mod = await import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`);
});

after(() => {
    if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
});

/** Same harness as tests/phase_p2_2_edit_trip_initial_state.test.js. */
function createHarness() {
    let state;
    const raw = mod.default.data.call({});
    Object.defineProperty(raw, 'activeFleetBuses', {
        enumerable: true,
        get() { return mod.default.computed.activeFleetBuses.call(state); }
    });
    Object.defineProperty(raw, 'selectedFleetBus', {
        enumerable: true,
        get() { return mod.default.computed.selectedFleetBus.call(state); }
    });
    state = reactive(raw);

    for (const [name, fn] of Object.entries(mod.default.methods)) {
        state[name] = fn.bind(state);
    }

    watch(
        () => state.selectedFleetBusId,
        (newVal, oldVal) => mod.default.watch.selectedFleetBusId.call(state, newVal, oldVal)
    );

    const call = (name, ...args) => state[name](...args);
    return { state, call };
}

function makeTicketFixture(overrides = {}) {
    return {
        id: 75, operator_id: 501, bus_id: '1',
        transport_company: 'ООО Перевозчик',
        from_city: 'Худжанд', from_address: 'Автовокзал Рохи Абрешим',
        to_city: 'Нижневартовск', to_address: 'Автовокзал',
        departure_date: '2027-09-23', departure_time: '18:00',
        arrival_date: null, arrival_time: '10:00', duration_minutes: 960,
        price: 840, premium_price: null,
        bus_type: 'single', total_seats: 45, floor1_seats: null, floor2_seats: null,
        reserved_seats: [1, 2, 3, 4, 5], active_bookings_count: 5,
        status: 'active',
        passenger_comments: '', intermediate_stops: [], photos: [],
        group_leader_name: null, group_leader_phone: null, group_leader_whatsapp: null,
        ...overrides
    };
}

function makeFleetBusFixture(overrides = {}) {
    return {
        id: 1, status: 'active', bus_type: 'single',
        total_seats: 45, floor1_seats: null, floor2_seats: null,
        brand: 'Setra', model: 'S 431 DT', name: 'Автобус 1',
        license_plate: '01 A 001 AA', year_built: 2019, photos: [],
        ...overrides
    };
}

async function openEditAndLoadFleet(state, call, ticket, fleetBuses) {
    mod.api.get = async (url) => {
        if (url === '/bus-admin/buses') return { data: fleetBuses };
        return { data: [] };
    };
    call('editTicket', ticket);
    await nextTick();
    await call('fetchFleetBuses');
    await nextTick();
    state.busForm.accept_terms = true;
}

function makeApiError(status, data) {
    return { response: { status, data } };
}

describe('P.2.5 — M: an unexpected-500 (SERVER_ERROR) response appends the correlation_id to the alert', () => {
    it('displays "Ошибка при обновлении: Внутренняя ошибка сервера" + "Код ошибки: <id>" without touching any other branch', async () => {
        const { state, call } = createHarness();
        const ticket = makeTicketFixture();
        const fleet = [makeFleetBusFixture({ id: 1 })];
        await openEditAndLoadFleet(state, call, ticket, fleet);
        state.tickets = [ticket];
        state.editingTicketId = ticket.id;
        state.busForm.price = '700';

        mod.api.put = async () => {
            throw makeApiError(500, { error: 'SERVER_ERROR', message: 'Внутренняя ошибка сервера', correlation_id: 'a1b2c3d4-0000-4000-8000-000000000001' });
        };

        let alertMessage = null;
        globalThis.alert = (msg) => { alertMessage = msg; };

        await call('updateBusTicket', false, true, null, true); // bypass price confirmation, go straight to the API call

        assert.ok(alertMessage, 'alert must have been called');
        assert.ok(alertMessage.startsWith('Ошибка при обновлении: Внутренняя ошибка сервера'), alertMessage);
        assert.ok(alertMessage.includes('Код ошибки: a1b2c3d4-0000-4000-8000-000000000001'), alertMessage);
    });

    it('a 500 with NO correlation_id (unexpected legacy/other shape) still shows a plain message with no "Код ошибки" line', async () => {
        const { state, call } = createHarness();
        const ticket = makeTicketFixture();
        const fleet = [makeFleetBusFixture({ id: 1 })];
        await openEditAndLoadFleet(state, call, ticket, fleet);
        state.tickets = [ticket];
        state.editingTicketId = ticket.id;
        state.busForm.price = '700';

        mod.api.put = async () => {
            throw makeApiError(500, { error: 'SERVER_ERROR', message: 'Внутренняя ошибка сервера' });
        };

        let alertMessage = null;
        globalThis.alert = (msg) => { alertMessage = msg; };

        await call('updateBusTicket', false, true, null, true);

        assert.ok(alertMessage.startsWith('Ошибка при обновлении: Внутренняя ошибка сервера'));
        assert.ok(!alertMessage.includes('Код ошибки'), 'must not fabricate a correlation id line when the backend did not send one');
    });
});

describe('P.2.5 — N: every existing controlled 4xx/409/503 branch is preserved and renders its own message, not the generic one', () => {
    async function saveAndCapture(apiPutImpl) {
        const { state, call } = createHarness();
        const ticket = makeTicketFixture();
        const fleet = [makeFleetBusFixture({ id: 1 })];
        await openEditAndLoadFleet(state, call, ticket, fleet);
        state.tickets = [ticket];
        state.editingTicketId = ticket.id;
        state.busForm.price = '700';
        mod.api.put = apiPutImpl;
        let alertMessage = null;
        globalThis.alert = (msg) => { alertMessage = msg; };
        await call('updateBusTicket', false, true, null, true);
        return { state, alertMessage };
    }

    it('409 BUS_SCHEDULE_CONFLICT opens the schedule-conflict modal, not a generic alert', async () => {
        const { state, alertMessage } = await saveAndCapture(async () => {
            throw makeApiError(409, { error: 'BUS_SCHEDULE_CONFLICT', message: 'Обнаружен конфликт расписания для выбранного автобуса', conflicts: [{ id: 2 }] });
        });
        assert.equal(state.showScheduleConflictModal, true);
        assert.deepEqual(state.scheduleConflicts, [{ id: 2 }]);
        assert.equal(alertMessage, null, 'no generic alert for a controlled conflict — the dedicated modal handles it');
    });

    it('409 BUS_SEAT_REMAP_REQUIRED opens the seat-remap modal, not a generic alert', async () => {
        const { state, alertMessage } = await saveAndCapture(async () => {
            throw makeApiError(409, {
                error: 'BUS_SEAT_REMAP_REQUIRED',
                newBus: { id: 9, total_seats: 40, bus_type: 'single' },
                affectedBookings: [{ id: 1, seat_numbers: [1] }]
            });
        });
        assert.equal(state.showSeatRemapModal, true);
        assert.equal(alertMessage, null);
    });

    it('409 ROUTE_CHANGE_REQUIRES_SEPARATE_TRIP still shows its own specific Russian alert (unaffected by the correlation_id change)', async () => {
        const { alertMessage } = await saveAndCapture(async () => {
            throw makeApiError(409, { error: 'ROUTE_CHANGE_REQUIRES_SEPARATE_TRIP' });
        });
        assert.equal(alertMessage, 'Изменение основных городов при наличии активных бронирований запрещено. Пожалуйста, создайте новый рейс или отмените старый.');
    });

    it('409 BUS_REPLACEMENT_HAS_BOOKINGS still shows its own specific alert with the booking count', async () => {
        const { alertMessage } = await saveAndCapture(async () => {
            throw makeApiError(409, { error: 'BUS_REPLACEMENT_HAS_BOOKINGS', activeBookingCount: 5 });
        });
        assert.ok(alertMessage.includes('активных бронирований: 5'));
    });

    it('400 BUS_UNASSIGN_FORBIDDEN still shows its own specific alert', async () => {
        const { alertMessage } = await saveAndCapture(async () => {
            throw makeApiError(400, { error: 'BUS_UNASSIGN_FORBIDDEN' });
        });
        assert.equal(alertMessage, 'Нельзя отвязать автобус от рейса. Вы можете выбрать другой автобус из своего автопарка.');
    });

    it('503 fail-closed (service-role unavailable) still shows its own safe Russian message, never the generic "Внутренняя ошибка сервера" text', async () => {
        const { alertMessage } = await saveAndCapture(async () => {
            throw makeApiError(503, { error: 'Сервис временно недоступен. Повторите попытку позже.' });
        });
        assert.equal(alertMessage, 'Ошибка при обновлении: Сервис временно недоступен. Повторите попытку позже.');
        assert.ok(!alertMessage.includes('Код ошибки'), '503 fail-closed responses never carry a correlation_id');
    });
});
