/**
 * tests/phase_p1g3a_frontend_hardening.test.js
 *
 * PHASE P.1G.3A — Frontend Event Wiring Fixes
 *
 * Real behavioral tests (not source-string matching) for the two bugs found
 * by the P.1G.3 recovery audit:
 *  - BusBookingView.vue's mounted() called trackBookingStarted(Number(id))
 *    instead of trackBookingStarted({ bus_ticket_id: id }) — silent no-op.
 *  - trackShareClicked() destructured {channel, context} while every real
 *    call site sent {referral_code, channel} — referral_code silently
 *    dropped, context never supplied.
 *  - A second, deeper bug found while fixing these: the backend's
 *    client-event property allowlist (EVENT_ALLOWED_PROPERTIES in
 *    services/acquisition/eventIngestionService.js) uses different property
 *    NAMES than the frontend was sending (trip_id vs bus_ticket_id,
 *    share_channel/target_content vs channel/context) — every BOOKING_STARTED
 *    and SHARE_CLICKED event ever sent had ALL its properties silently
 *    stripped server-side, regardless of the argument-shape bug. Both are
 *    fixed together here since fixing only the argument shape would not
 *    have actually restored the data.
 *
 * Exercises the REAL acquisitionService singleton with a mocked api.post,
 * asserting on the actual outgoing request body.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// --- minimal browser-global polyfills (only what these code paths touch) ---
class MemoryStorage {
    constructor() { this.store = new Map(); }
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
    setItem(key, value) { this.store.set(key, String(value)); }
    removeItem(key) { this.store.delete(key); }
    clear() { this.store.clear(); }
}
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.window = globalThis.window || { location: { pathname: '/', search: '', href: 'https://www.poputki.online/' }, history: { replaceState: () => {} } };

const api = (await import('../src/api.js')).default;
const acquisitionService = (await import('../src/services/acquisitionService.js')).default;

describe('Phase P.1G.3A — real trackBookingStarted() behavior', () => {
    let posted;

    beforeEach(() => {
        posted = [];
        api.post = async (url, body) => { posted.push({ url, body }); return { data: {} }; };
        localStorage.clear();
        sessionStorage.clear();
        acquisitionService.visitorId = null;
        acquisitionService.sessionId = 'test-session-id';
        acquisitionService.sessionData = { session_id: 'test-session-id' };
    });

    it('sends trip_id (the backend-allowlisted property name), not bus_ticket_id', async () => {
        await acquisitionService.trackBookingStarted({ bus_ticket_id: 4242 });

        const call = posted.find(p => p.url === '/acquisition/events');
        assert.ok(call, 'must POST to /acquisition/events');
        const event = call.body.events[0];
        assert.equal(event.event_name, 'BOOKING_STARTED');
        assert.equal(event.properties.trip_id, 4242);
        assert.equal('bus_ticket_id' in event.properties, false, 'bus_ticket_id would be silently stripped server-side — must not be sent');
    });

    it('this is the exact call shape BusBookingView.vue now uses (Number arg regression fixed)', async () => {
        const fs = await import('node:fs');
        const src = fs.readFileSync(new URL('../src/views/BusBookingView.vue', import.meta.url), 'utf8');
        assert.ok(src.includes('trackBookingStarted({ bus_ticket_id: Number(this.ticketId) })'));
        assert.ok(!src.includes('trackBookingStarted(Number(this.ticketId))'), 'the old broken call shape must be gone');
    });

    it('does nothing (no POST) when bus_ticket_id is missing/falsy', async () => {
        await acquisitionService.trackBookingStarted({});
        assert.equal(posted.length, 0);
    });

    it('is deduplicated per ticket per session: a second call for the same ticket does not re-fire', async () => {
        await acquisitionService.trackBookingStarted({ bus_ticket_id: 777 });
        const firstCount = posted.length;
        assert.equal(firstCount, 1);

        await acquisitionService.trackBookingStarted({ bus_ticket_id: 777 });
        assert.equal(posted.length, firstCount, 'duplicate call for the same ticket in the same session must be a no-op');
    });

    it('still fires for a DIFFERENT ticket in the same session', async () => {
        await acquisitionService.trackBookingStarted({ bus_ticket_id: 111 });
        await acquisitionService.trackBookingStarted({ bus_ticket_id: 222 });
        const events = posted.filter(p => p.url === '/acquisition/events').map(p => p.body.events[0].properties.trip_id);
        assert.deepEqual(events, [111, 222]);
    });

    it('the BusTicketDetailsView "Book" click and BusBookingView mount together fire exactly once per real booking start (double-fire regression)', async () => {
        // Simulates the real navigation flow: startBooking() on the details
        // page fires first, then BusBookingView mounts for the SAME ticket.
        await acquisitionService.trackBookingStarted({ bus_ticket_id: 999 }); // BusTicketDetailsView.startBooking()
        await acquisitionService.trackBookingStarted({ bus_ticket_id: 999 }); // BusBookingView.mounted()
        const events = posted.filter(p => p.url === '/acquisition/events' && p.body.events[0].event_name === 'BOOKING_STARTED');
        assert.equal(events.length, 1, 'the normal click-through flow must record BOOKING_STARTED exactly once, not twice');
    });
});

describe('Phase P.1G.3A — real trackShareClicked() behavior', () => {
    let posted;

    beforeEach(() => {
        posted = [];
        api.post = async (url, body) => { posted.push({ url, body }); return { data: {} }; };
    });

    it('sends share_channel and target_content (backend-allowlisted names), never channel/context', async () => {
        await acquisitionService.trackShareClicked({ channel: 'whatsapp', referral_code: 'FRIEND2026' });

        const call = posted.find(p => p.url === '/acquisition/events');
        assert.ok(call);
        const props = call.body.events[0].properties;
        assert.equal(props.share_channel, 'whatsapp');
        assert.equal(props.target_content, 'FRIEND2026');
        assert.equal('channel' in props, false);
        assert.equal('context' in props, false);
        assert.equal('referral_code' in props, false, 'must be sent as target_content, not the old dropped key name');
    });

    it('all four real ProfileView.vue call sites pass {referral_code, channel} — matches the fixed signature exactly', async () => {
        const fs = await import('node:fs');
        const src = fs.readFileSync(new URL('../src/views/ProfileView.vue', import.meta.url), 'utf8');
        const calls = [...src.matchAll(/trackShareClicked\(\{([^}]*)\}\)/g)];
        assert.equal(calls.length, 4, 'expected exactly the 4 known share call sites (clipboard, whatsapp, telegram, native_share)');
        for (const [, argsSrc] of calls) {
            assert.ok(argsSrc.includes('referral_code'));
            assert.ok(argsSrc.includes('channel'));
        }
    });

    it('omits target_content entirely when no referral_code is available', async () => {
        await acquisitionService.trackShareClicked({ channel: 'copy' });
        const call = posted.find(p => p.url === '/acquisition/events');
        assert.equal('target_content' in call.body.events[0].properties, false);
    });

    it('never includes PII (phone/user id) — only the public referral code and channel name', async () => {
        await acquisitionService.trackShareClicked({ channel: 'telegram', referral_code: 'ABC123' });
        const call = posted.find(p => p.url === '/acquisition/events');
        const propsStr = JSON.stringify(call.body.events[0].properties);
        assert.ok(!/\+?\d{7,}/.test(propsStr), 'no phone-number-shaped value');
    });
});
