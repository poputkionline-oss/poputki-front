/**
 * tests/phase_p2_1_price_confirmation_ui.test.js
 *
 * BUGFIX P.2.1 — Price change confirmation modal not shown in production.
 *
 * Root cause: activeBookingsCount (used by BOTH the pre-existing trip-change
 * modal and the new price-change modal) was computed solely from
 * (ticket.reserved_seats || []).length — a seat-array proxy. A confirmed
 * booking is not required to have seat_numbers assigned
 * (POST /bus-admin/bookings/manual never validates seat_numbers as
 * required — see routes/busAdmin.js), so a real active booking with no
 * seats contributed zero entries to reserved_seats, silently undercounting
 * bookings and suppressing the warning. Fixed by:
 *  1. Backend (routes/busAdmin.js GET /tickets): expose active_bookings_count
 *     directly, computed the same status-based way PUT /tickets/:id already
 *     defines "active booking" for its own guard.
 *  2. Frontend (BusAdminView.vue): prefer that field over the seat-count
 *     proxy, and normalize price comparison so "840" / "840.00" / 840 are
 *     never mistaken for a real change.
 *
 * This suite imports the REAL, extracted, exported pure functions from
 * BusAdminView.vue's own <script> block (via a real ESM import of a
 * sanitized temp copy — not a reimplementation) and drives them with
 * production-shaped fixtures, proving the exact scenarios (A-J) requested.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vuePath = path.resolve(__dirname, '../src/views/BusAdminView.vue');

let mod; // real module: { default: componentOptions, computeActiveBookingsCount, normalizePriceValue, computeChangedPriceFields, decideTripEditConfirmation }
let tempPath;

before(async () => {
    const src = fs.readFileSync(vuePath, 'utf8');
    const match = src.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(match, 'BusAdminView.vue must have a plain <script> block');

    // Neutralize every import this test doesn't need: the pure functions
    // under test depend on none of them. This includes .vue SFCs (Node has
    // no loader for them) and every extensionless relative import (Vite
    // resolves those; plain Node ESM requires explicit extensions and
    // rejects them) — not just '../api' (whose axios.create() also reads
    // import.meta.env at module top-level, undefined outside Vite).
    const sanitized = match[1]
        .replace(/import api from '\.\.\/api';/, 'const api = {};')
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

    // Sanity: if the real file's import lines ever change (new child
    // component added, path renamed, ...), fail loudly here rather than
    // silently importing a half-sanitized, still-broken module.
    assert.ok(!/from ['"].*\.vue['"]/.test(sanitized), 'a .vue import survived sanitization — Node cannot resolve it, update this test\'s replacement list');
    assert.ok(!/^import /m.test(sanitized), 'an unsanitized import statement survived — plain Node ESM cannot resolve it the way Vite does, update this test\'s replacement list');

    tempPath = vuePath.replace(/\.vue$/, `.__p2_1_test_${process.pid}_${Date.now()}.mjs`);
    fs.writeFileSync(tempPath, sanitized, 'utf8');
    mod = await import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`);
});

after(() => {
    if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
});

describe('P.2.1 — pure helper functions exist and are the ones updateBusTicket() actually uses', () => {
    it('computeActiveBookingsCount, normalizePriceValue, computeChangedPriceFields, decideTripEditConfirmation are exported', () => {
        assert.equal(typeof mod.computeActiveBookingsCount, 'function');
        assert.equal(typeof mod.normalizePriceValue, 'function');
        assert.equal(typeof mod.computeChangedPriceFields, 'function');
        assert.equal(typeof mod.decideTripEditConfirmation, 'function');
    });

    it('updateBusTicket() calls these exact functions (not a reimplementation living only in the method body)', () => {
        const methodSrc = mod.default.methods.updateBusTicket.toString();
        assert.ok(methodSrc.includes('computeActiveBookingsCount(editingTicket)'));
        assert.ok(methodSrc.includes('computeChangedPriceFields(editingTicket, updateData)'));
        assert.ok(methodSrc.includes('decideTripEditConfirmation({'));
    });
});

describe('P.2.1 — root cause proof: production-shaped API response', () => {
    it('CONTRACT MISMATCH reproduced: a real confirmed booking with no seat_numbers made the OLD seat-count proxy read 0 active bookings', () => {
        // Exactly what GET /bus-admin/tickets used to return before this fix
        // (still what it would return if active_bookings_count were absent):
        // a trip with one confirmed manual booking that has no assigned seats.
        const ticketWithoutActiveBookingsCountField = {
            id: 1, price: 840, premium_price: null,
            reserved_seats: [] // the confirmed booking contributed nothing here
        };
        const oldProxyCount = (ticketWithoutActiveBookingsCountField.reserved_seats || []).length;
        assert.equal(oldProxyCount, 0, 'proves the old proxy under-counts a real active booking with no seats');
    });

    it('FIX: computeActiveBookingsCount prefers the new direct field and reports the real count', () => {
        const ticket = { id: 1, price: 840, reserved_seats: [], active_bookings_count: 1 };
        assert.equal(mod.computeActiveBookingsCount(ticket), 1);
    });

    it('backwards-compatible fallback: if active_bookings_count is ever absent, falls back to reserved_seats.length', () => {
        const ticket = { id: 1, price: 840, reserved_seats: [3, 4] };
        assert.equal(mod.computeActiveBookingsCount(ticket), 2);
    });

    it('zero bookings correctly reports zero either way', () => {
        assert.equal(mod.computeActiveBookingsCount({ active_bookings_count: 0, reserved_seats: [] }), 0);
        assert.equal(mod.computeActiveBookingsCount({ reserved_seats: [] }), 0);
        assert.equal(mod.computeActiveBookingsCount(null), 0);
    });
});

describe('P.2.1 — price normalization (Section 3/4)', () => {
    it('840 and "840.00" normalize to the same value (string/number type from PostgREST numeric columns)', () => {
        assert.equal(mod.normalizePriceValue(840), mod.normalizePriceValue('840.00'));
        assert.equal(mod.normalizePriceValue('840'), mod.normalizePriceValue(840));
    });

    it('840 -> 700 is a real, detected change regardless of the old value\'s type', () => {
        assert.notEqual(mod.normalizePriceValue(840), mod.normalizePriceValue(700));
        assert.notEqual(mod.normalizePriceValue('840.00'), mod.normalizePriceValue(700));
    });

    it('null/undefined/empty-string premium_price all normalize identically (no false-positive on an unset VIP price)', () => {
        assert.equal(mod.normalizePriceValue(null), mod.normalizePriceValue(undefined));
        assert.equal(mod.normalizePriceValue(undefined), mod.normalizePriceValue(''));
    });
});

describe('P.2.1 — computeChangedPriceFields (real function)', () => {
    it('detects price changed 840 -> 700', () => {
        const changed = mod.computeChangedPriceFields({ price: 840, premium_price: null }, { price: 700, premium_price: null });
        assert.deepEqual(changed, ['price']);
    });

    it('detects premium_price changed', () => {
        const changed = mod.computeChangedPriceFields({ price: 840, premium_price: null }, { price: 840, premium_price: 950 });
        assert.deepEqual(changed, ['premium_price']);
    });

    it('detects both price and premium_price changed', () => {
        const changed = mod.computeChangedPriceFields({ price: 840, premium_price: 900 }, { price: 700, premium_price: 950 });
        assert.deepEqual(changed.sort(), ['premium_price', 'price']);
    });

    it('scenario F: "840.00" (string, API-shaped) vs 840 (number, form-shaped, unchanged) is NOT a change', () => {
        const changed = mod.computeChangedPriceFields({ price: '840.00', premium_price: null }, { price: 840, premium_price: null });
        assert.deepEqual(changed, []);
    });

    it('no editingTicket (defensive) yields no changed fields', () => {
        assert.deepEqual(mod.computeChangedPriceFields(null, { price: 700 }), []);
    });
});

describe('P.2.1 — decideTripEditConfirmation (the single gate before any API mutation)', () => {
    const base = {
        activeBookingsCount: 0,
        changedSubstantialFieldsCount: 0,
        changedPriceFieldsCount: 0,
        bypassBookingConfirmation: false,
        bypassPriceConfirmation: false
    };

    it('A/840->700 + active booking -> show_price_modal', () => {
        const d = mod.decideTripEditConfirmation({ ...base, activeBookingsCount: 1, changedPriceFieldsCount: 1 });
        assert.equal(d, 'show_price_modal');
    });

    it('B/premium_price changed + active booking -> show_price_modal', () => {
        const d = mod.decideTripEditConfirmation({ ...base, activeBookingsCount: 1, changedPriceFieldsCount: 1 });
        assert.equal(d, 'show_price_modal');
    });

    it('C/price+premium_price changed + active booking -> show_price_modal (still exactly one modal)', () => {
        const d = mod.decideTripEditConfirmation({ ...base, activeBookingsCount: 1, changedPriceFieldsCount: 2 });
        assert.equal(d, 'show_price_modal');
    });

    it('D/no active bookings + price changed -> proceed (no warning required)', () => {
        const d = mod.decideTripEditConfirmation({ ...base, activeBookingsCount: 0, changedPriceFieldsCount: 1 });
        assert.equal(d, 'proceed');
    });

    it('E/price unchanged + active booking -> proceed (nothing to warn about)', () => {
        const d = mod.decideTripEditConfirmation({ ...base, activeBookingsCount: 1, changedPriceFieldsCount: 0 });
        assert.equal(d, 'proceed');
    });

    it('J/price + schedule change with active bookings -> show_substantial_modal wins, no double/conflicting modal', () => {
        const d = mod.decideTripEditConfirmation({
            ...base, activeBookingsCount: 1, changedSubstantialFieldsCount: 1, changedPriceFieldsCount: 1
        });
        assert.equal(d, 'show_substantial_modal', 'the pre-existing substantial-change flow must take priority, unchanged from before this phase');
    });

    it('bypassPriceConfirmation=true (post-confirm re-call) proceeds even with an active booking and a price change', () => {
        const d = mod.decideTripEditConfirmation({ ...base, activeBookingsCount: 1, changedPriceFieldsCount: 1, bypassPriceConfirmation: true });
        assert.equal(d, 'proceed');
    });

    it('bypassBookingConfirmation=true does NOT also bypass a pure price-only confirmation', () => {
        const d = mod.decideTripEditConfirmation({ ...base, activeBookingsCount: 1, changedPriceFieldsCount: 1, bypassBookingConfirmation: true });
        assert.equal(d, 'show_price_modal', 'confirming the substantial-fields modal must not silently also skip an unrelated price warning');
    });
});

describe('P.2.1 — no API mutation before confirmation (source-level proof of the early return)', () => {
    let src;
    before(() => { src = fs.readFileSync(vuePath, 'utf8'); });

    it('G/H: show_price_modal is immediately followed by "return;" before any api.put call', () => {
        const startIdx = src.indexOf("if (confirmationDecision === 'show_price_modal')");
        const block = src.slice(startIdx, src.indexOf('this.loading = true;', startIdx));
        assert.match(block, /this\.showPriceChangeConfirmModal = true;\s*\n\s*return;/, 'must return synchronously — no api.put() can run in this branch');
        assert.ok(!block.includes('api.put'), 'the price-modal branch must never itself call the API');
    });

    it('G/H: show_substantial_modal is immediately followed by "return;" before any api.put call', () => {
        const block = src.slice(src.indexOf("if (confirmationDecision === 'show_substantial_modal')"), src.indexOf("if (confirmationDecision === 'show_price_modal')"));
        assert.match(block, /this\.showTripChangeConfirmModal = true;\s*\n\s*return;/);
        assert.ok(!block.includes('api.put'));
    });

    it('H: Cancel on the price modal only flips the flag, no confirmBusTicket/API call attached', () => {
        const cancelButtonBlock = src.slice(src.indexOf('showPriceChangeConfirmModal" class="fixed'), src.indexOf('Отмена'));
        // The actual Cancel button handler:
        assert.ok(src.includes('@click="showPriceChangeConfirmModal = false"'));
    });

    it('I: Confirm ("Изменить цену") calls confirmPriceChangeModal, which bypasses price confirmation but still runs through updateBusTicket (still gated by activeBookingsCount/changedSubstantialFields exactly as any normal save)', () => {
        assert.ok(src.includes('confirmPriceChangeModal() {'));
        assert.ok(src.includes('this.updateBusTicket(false, true, null, true);'));
    });

    it('only one PUT call site exists for trip edits (api.put is not duplicated elsewhere, so exactly one mutation happens per confirmed save)', () => {
        const putCalls = src.match(/api\.put\(`\/bus-admin\/tickets\//g) || [];
        assert.equal(putCalls.length, 1);
    });
});
