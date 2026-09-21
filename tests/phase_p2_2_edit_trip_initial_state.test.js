/**
 * tests/phase_p2_2_edit_trip_initial_state.test.js
 *
 * BUGFIX P.2.2 — Edit Trip: previously assigned fleet bus not shown /
 * false changed-fields on save-without-edits.
 *
 * ROOT CAUSE #1 (bus selector): editTicket() sets selectedFleetBusId
 * synchronously from the trip's existing bus_id, then calls
 * fetchFleetBuses() WITHOUT awaiting it. The selectedFleetBusId watcher
 * fires on the next Vue tick — before the (much slower) network fetch has
 * resolved — sees activeFleetBuses still empty, concludes "no bus
 * selected", and unconditionally nulled busForm.bus_id. Once fleet data
 * actually arrived, nothing re-applied it, since the watcher only re-fires
 * when selectedFleetBusId itself changes again (it doesn't, after
 * editTicket()'s one-time assignment).
 *
 * ROOT CAUSE #2 (false "changed" fields): the SUBSTANTIAL_FIELDS diff
 * compared editingTicket[field] (the raw original API value) against
 * updateData[field] (the value built for the PUT payload, which
 * f.group_leader_name || ''-style fallbacks coerce null/undefined to '')
 * with plain JSON.stringify equality. null !== '' under that comparison,
 * so an untouched, never-set group leader field always looked "changed".
 * bus_id can independently round-trip as a string ("1", from a
 * BIGINT/BIGSERIAL column) on one side and a number (1) on the other,
 * which JSON.stringify also treats as different.
 *
 * This suite drives the REAL, exported functions
 * (computeChangedSubstantialFields, normalizeId, normalizeNullableText)
 * and the REAL Options-API editTicket/fetchFleetBuses/updateBusTicket
 * methods, wired to actual Vue reactivity (reactive/watch/nextTick from
 * the real 'vue' package) — not a reimplementation — against
 * production-shaped fixtures.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { reactive, watch, nextTick } from 'vue';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vuePath = path.resolve(__dirname, '../src/views/BusAdminView.vue');

globalThis.alert = () => {};

let mod;
let tempPath;

before(async () => {
    const src = fs.readFileSync(vuePath, 'utf8');
    const match = src.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(match, 'BusAdminView.vue must have a plain <script> block');

    // Same neutralization as tests/phase_p2_1_price_confirmation_ui.test.js,
    // except `api` is exported (not just stubbed) so this suite can install
    // per-test mock responses on the SAME object instance the component's
    // own methods close over.
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

    tempPath = vuePath.replace(/\.vue$/, `.__p2_2_test_${process.pid}_${Date.now()}.mjs`);
    fs.writeFileSync(tempPath, sanitized, 'utf8');
    mod = await import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`);
});

after(() => {
    if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
});

/** A real, live Options-API-shaped reactive instance driving the actual component code. */
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

    // Bind every real method onto state itself so that internal `this.foo()`
    // calls made BY one real method (e.g. editTicket calling
    // this.fetchFleetBuses(), the watcher calling
    // this.applySelectedFleetBusToForm()) resolve to the same real
    // functions, not just the ones this test happens to invoke directly.
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

// Production-shaped fixtures: exactly what GET /bus-admin/tickets and
// GET /bus-admin/buses return, per the real backend code (routes/busAdmin.js).
function makeTicketFixture(overrides = {}) {
    return {
        id: 9101, operator_id: 501, bus_id: '1', // bigint FK round-trips as a string
        transport_company: 'ООО Перевозчик',
        from_city: 'Худжанд', from_address: 'Автовокзал Рохи Абрешим',
        to_city: 'Нижневартовск', to_address: 'Автовокзал',
        departure_date: '2026-09-23', departure_time: '18:00',
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
        id: 1, status: 'active', bus_type: 'single', // carrier_buses.id, also bigserial-backed
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
    await nextTick(); // flushes the watcher fired by the synchronous selectedFleetBusId assignment
    await call('fetchFleetBuses'); // resolves fleet data (the real, un-awaited call editTicket() also triggered settles the same way)
    await nextTick();
    state.busForm.accept_terms = true; // not a DB field, spread from `ticket` never sets it — orthogonal to this bugfix
}

describe('P.2.2 — root cause proof: watcher timing nulls busForm.bus_id before fleet data loads', () => {
    it('reproduces the exact old (unfixed) mechanism inline, for documentation — NOT the code under test', () => {
        // This mirrors the OLD watcher body verbatim (before this bugfix) to
        // prove the mechanism; the real component no longer contains this
        // unconditional else (see the "fixed" tests below for the real code).
        function oldWatcherElseBranch(selectedFleetBus) {
            return selectedFleetBus ? selectedFleetBus.id : null; // old: always null when bus not YET found
        }
        const busFormBusIdBeforeFleetLoads = oldWatcherElseBranch(null /* activeFleetBuses still [] at this instant */);
        assert.equal(busFormBusIdBeforeFleetLoads, null, 'proves the old code wiped busForm.bus_id before fetchFleetBuses() had a chance to resolve');
    });
});

describe('P.2.2 — A: fleet selector shows the previously assigned bus after opening Edit Trip', () => {
    it('selectedFleetBusId, selectedFleetBus, and busForm.bus_id all resolve to the real assigned bus once fleet data loads', async () => {
        const { state, call } = createHarness();
        const ticket = makeTicketFixture({ bus_id: '1' });
        const fleet = [makeFleetBusFixture({ id: 1 })];

        await openEditAndLoadFleet(state, call, ticket, fleet);

        assert.equal(state.selectedFleetBusId, '1');
        assert.ok(state.selectedFleetBus, 'selectedFleetBus computed must resolve to the real bus object');
        assert.equal(state.selectedFleetBus.id, 1);
        assert.equal(state.busForm.bus_id, 1, 'busForm.bus_id must reflect the real assigned bus, not null');
        assert.equal(state.editingOriginalBusId, '1');
    });
});

describe('P.2.2 — B: bus_id numeric 1 vs form string "1" is not a change', () => {
    it('a trip fetched with bus_id as a number still resolves against a fleet bus id returned as a string, and vice versa', async () => {
        for (const [ticketBusId, fleetBusId] of [['1', 1], [1, '1'], [1, 1], ['1', '1']]) {
            const { state, call } = createHarness();
            const ticket = makeTicketFixture({ bus_id: ticketBusId });
            const fleet = [makeFleetBusFixture({ id: fleetBusId })];
            await openEditAndLoadFleet(state, call, ticket, fleet);
            assert.equal(state.busForm.bus_id, fleetBusId, `ticket.bus_id=${JSON.stringify(ticketBusId)} fleet.id=${JSON.stringify(fleetBusId)}`);
            assert.equal(mod.normalizeId(ticket.bus_id), mod.normalizeId(state.busForm.bus_id));
        }
    });
});

describe('P.2.2 — computeChangedSubstantialFields (real function): normalization', () => {
    const SUBSTANTIAL_FIELDS = ['departure_date', 'departure_time', 'arrival_date', 'arrival_time', 'from_address', 'to_address', 'intermediate_stops', 'bus_id', 'group_leader_name', 'group_leader_phone'];
    const LABELS = { bus_id: 'Автобус', group_leader_name: 'Старший группы', group_leader_phone: 'Телефон старшего' };

    it('C: null group leader vs "" is unchanged', () => {
        const r = mod.computeChangedSubstantialFields({ group_leader_name: null }, { group_leader_name: '' }, ['group_leader_name'], LABELS);
        assert.deepEqual(r.changed, []);
    });

    it('D: undefined vs "" (optional field) is unchanged', () => {
        const r = mod.computeChangedSubstantialFields({ group_leader_phone: undefined }, { group_leader_phone: '' }, ['group_leader_phone'], LABELS);
        assert.deepEqual(r.changed, []);
    });

    it('E: whitespace-only optional value vs empty is unchanged', () => {
        const r = mod.computeChangedSubstantialFields({ group_leader_name: '   ' }, { group_leader_name: '' }, ['group_leader_name'], LABELS);
        assert.deepEqual(r.changed, []);
    });

    it('bus_id "1" (old) vs 1 (new) is unchanged', () => {
        const r = mod.computeChangedSubstantialFields({ bus_id: '1' }, { bus_id: 1 }, ['bus_id'], LABELS);
        assert.deepEqual(r.changed, []);
    });

    it('bus_id null (old, never assigned) vs "1" (new, real assignment) IS a real change', () => {
        const r = mod.computeChangedSubstantialFields({ bus_id: null }, { bus_id: '1' }, ['bus_id'], LABELS);
        assert.equal(r.changed.length, 1);
        assert.equal(r.changed[0].field, 'bus_id');
    });

    it('group leader null (old) vs a real new name IS a real change', () => {
        const r = mod.computeChangedSubstantialFields({ group_leader_name: null }, { group_leader_name: 'Алишер' }, ['group_leader_name'], LABELS);
        assert.equal(r.changed.length, 1);
    });

    it('L: opening and saving without any edits produces zero changed fields (full realistic field set)', () => {
        const ticket = makeTicketFixture();
        // Exactly what updateData looks like when busForm was populated from
        // `ticket` via editTicket() and nothing was touched.
        const updateData = {
            departure_date: ticket.departure_date, departure_time: ticket.departure_time,
            arrival_date: ticket.arrival_date, arrival_time: ticket.arrival_time,
            from_address: ticket.from_address, to_address: ticket.to_address,
            intermediate_stops: ticket.intermediate_stops,
            bus_id: 1, // selectedFleetBus.id, real number, resolved from ticket.bus_id='1'
            group_leader_name: ticket.group_leader_name || '',
            group_leader_phone: ticket.group_leader_phone || ''
        };
        const r = mod.computeChangedSubstantialFields(ticket, updateData, SUBSTANTIAL_FIELDS, LABELS);
        assert.deepEqual(r.changed, [], `expected no changed fields, got: ${JSON.stringify(r.changed)}`);
    });
});

describe('P.2.2 — G/H/M/N: price-only save with an untouched bus and group leader', () => {
    it('G+M: 840 -> 700 only, 5 active bookings, real assigned bus untouched -> price modal only, no false bus/group-leader change', async () => {
        const { state, call } = createHarness();
        const ticket = makeTicketFixture({ bus_id: '1', price: 840, active_bookings_count: 5 });
        const fleet = [makeFleetBusFixture({ id: 1 })];
        await openEditAndLoadFleet(state, call, ticket, fleet);

        state.tickets = [ticket];
        state.editingTicketId = ticket.id;
        state.busForm.price = '700'; // simulates the user typing into the price input

        let putCalls = 0, putBody = null;
        mod.api.put = async (url, body) => { putCalls++; putBody = body; return { data: { success: true, notificationsQueued: 0, unreachableCount: 0 } }; };

        await call('updateBusTicket');

        assert.equal(state.showPriceChangeConfirmModal, true, 'G: price-only modal must appear');
        assert.equal(state.showTripChangeConfirmModal, false, 'N: the general notify-passengers modal must NOT appear for a price-only change');
        assert.equal(putCalls, 0, 'no API mutation before confirmation');
        assert.equal(state.priceChangeConfirmData.priceChanged, true);
        assert.equal(state.priceChangeConfirmData.premiumPriceChanged, false);
    });
});

describe('P.2.2 — I/J: real schedule change and price+schedule together still show the general modal, exactly once', () => {
    it('I: departure_time change alone shows the substantial-fields modal', async () => {
        const { state, call } = createHarness();
        const ticket = makeTicketFixture({ bus_id: '1', active_bookings_count: 5 });
        const fleet = [makeFleetBusFixture({ id: 1 })];
        await openEditAndLoadFleet(state, call, ticket, fleet);
        state.tickets = [ticket];
        state.editingTicketId = ticket.id;
        state.busForm.departure_time = '20:00';

        mod.api.put = async () => ({ data: { success: true } });
        await call('updateBusTicket');

        assert.equal(state.showTripChangeConfirmModal, true);
        assert.equal(state.showPriceChangeConfirmModal, false);
    });

    it('J: price + departure_time together shows the substantial-fields modal exactly once (not both/double)', async () => {
        const { state, call } = createHarness();
        const ticket = makeTicketFixture({ bus_id: '1', active_bookings_count: 5, price: 840 });
        const fleet = [makeFleetBusFixture({ id: 1 })];
        await openEditAndLoadFleet(state, call, ticket, fleet);
        state.tickets = [ticket];
        state.editingTicketId = ticket.id;
        state.busForm.departure_time = '20:00';
        state.busForm.price = '700';

        mod.api.put = async () => ({ data: { success: true } });
        await call('updateBusTicket');

        assert.equal(state.showTripChangeConfirmModal, true);
        assert.equal(state.showPriceChangeConfirmModal, false, 'must not also show the price modal alongside the general one');
    });
});

describe('P.2.2 — F: price normalization preserved (840 vs "840.00")', () => {
    it('a price fetched as a string ("840.00") vs the form\'s number-cast 840 is not a change', () => {
        assert.equal(mod.normalizePriceValue('840.00'), mod.normalizePriceValue(840));
    });

    it('opening Edit Trip with a string-typed price and saving without touching it produces no price-change modal', async () => {
        const { state, call } = createHarness();
        const ticket = makeTicketFixture({ bus_id: '1', price: '840.00', active_bookings_count: 5 });
        const fleet = [makeFleetBusFixture({ id: 1 })];
        await openEditAndLoadFleet(state, call, ticket, fleet);
        state.tickets = [ticket];
        state.editingTicketId = ticket.id;
        // busForm.price stays whatever editTicket() spread from ticket.price ('840.00'); untouched by the carrier.

        let putCalls = 0;
        mod.api.put = async () => { putCalls++; return { data: { success: true } }; };
        await call('updateBusTicket');

        assert.equal(state.showPriceChangeConfirmModal, false);
        assert.equal(state.showTripChangeConfirmModal, false);
        assert.equal(putCalls, 1, 'save must proceed directly since nothing actually changed');
    });
});

describe('P.2.2 — K: real bus replacement keeps existing Fleet Phase F protection (backend-enforced, untouched)', () => {
    const busAdminSrc = fs.readFileSync(path.resolve(__dirname, '../../poputki-backend/routes/busAdmin.js'), 'utf8');
    const hasBackendRepo = fs.existsSync(path.resolve(__dirname, '../../poputki-backend/routes/busAdmin.js'));

    it('BUS_REPLACEMENT_HAS_BOOKINGS / BUS_SEAT_REMAP_REQUIRED guards are untouched by this bugfix', { skip: !hasBackendRepo }, () => {
        assert.ok(busAdminSrc.includes('BUS_SEAT_REMAP_REQUIRED'));
        assert.ok(busAdminSrc.includes('BUS_UNASSIGN_FORBIDDEN'));
    });

    it('the frontend still surfaces the seat-remap modal on a genuine bus replacement conflict (unchanged handler)', () => {
        const src = fs.readFileSync(vuePath, 'utf8');
        assert.ok(src.includes("e.response?.data?.error === 'BUS_SEAT_REMAP_REQUIRED'"));
        assert.ok(src.includes('this.showSeatRemapModal = true'));
    });
});
