/**
 * tests/phase_p1g3a_contract_parity.test.js
 *
 * PHASE P.1G.3A — Client/Backend Event Contract Parity (frontend half)
 *
 * Companion to poputki-backend/tests/phase_p1g3a_contract_parity.test.js,
 * which exercises the same contract against the REAL backend
 * sanitizeProperties()/EVENT_ALLOWED_PROPERTIES (services/acquisition/
 * eventIngestionService.js). The two repos have no shared package, so this
 * file exercises the REAL frontend acquisitionService singleton and captures
 * its actual outgoing request body, then checks it against BACKEND_CONTRACT
 * below — a literal, explicitly-labelled mirror of the backend's real
 * EVENT_ALLOWED_PROPERTIES allowlist as of Phase P.1G.3A. If the backend
 * allowlist ever changes, this mirror (and the backend-side fixtures) must
 * be updated together — that cost is made visible here rather than silently
 * drifting the way the original P.1G.3 bug did.
 *
 * Backend source of truth this mirrors:
 *   poputki-backend/services/acquisition/eventIngestionService.js
 *   EVENT_ALLOWED_PROPERTIES = {
 *     LANDING_VIEWED:  ['page_path', 'locale', 'referrer_host'],
 *     ROUTE_SEARCHED:  ['from_city', 'to_city', 'departure_date', 'seats_requested'],
 *     TRIP_VIEWED:     ['trip_id', 'from_city', 'to_city', 'price_tier'],
 *     BOOKING_STARTED: ['trip_id', 'seats_count'],
 *     TELEGRAM_OPENED: ['target_channel', 'handoff_point'],
 *     SHARE_CLICKED:   ['share_channel', 'target_content']
 *   }
 *   FORBIDDEN_PII_KEYS = ['phone','passport','password','token','jwt',
 *     'telegram_token','card_number','cvv','full_name','email']
 *
 * Not a content.includes test: every assertion runs against the real
 * request body captured from a mocked api.post while calling the real
 * acquisitionService methods.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const BACKEND_CONTRACT = {
    LANDING_VIEWED: new Set(['page_path', 'locale', 'referrer_host']),
    ROUTE_SEARCHED: new Set(['from_city', 'to_city', 'departure_date', 'seats_requested']),
    TRIP_VIEWED: new Set(['trip_id', 'from_city', 'to_city', 'price_tier']),
    BOOKING_STARTED: new Set(['trip_id', 'seats_count']),
    TELEGRAM_OPENED: new Set(['target_channel', 'handoff_point']),
    SHARE_CLICKED: new Set(['share_channel', 'target_content'])
};

const FORBIDDEN_PII_KEYS = ['phone', 'passport', 'password', 'token', 'jwt', 'telegram_token', 'card_number', 'cvv', 'full_name', 'email'];

class MemoryStorage {
    constructor() { this.store = new Map(); }
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
    setItem(key, value) { this.store.set(key, String(value)); }
    removeItem(key) { this.store.delete(key); }
    clear() { this.store.clear(); }
}
globalThis.localStorage = globalThis.localStorage || new MemoryStorage();
globalThis.sessionStorage = globalThis.sessionStorage || new MemoryStorage();
globalThis.window = globalThis.window || { location: { pathname: '/', search: '', href: 'https://www.poputki.online/' }, history: { replaceState: () => {} }, open: () => {} };

const api = (await import('../src/api.js')).default;
const acquisitionService = (await import('../src/services/acquisitionService.js')).default;

function assertNoPii(properties) {
    const str = JSON.stringify(properties).toLowerCase();
    for (const forbidden of FORBIDDEN_PII_KEYS) {
        assert.ok(!str.includes(`"${forbidden}"`), `must not contain the forbidden PII key "${forbidden}"`);
    }
    assert.ok(!/\+?\d{7,}/.test(str), 'must not contain a phone-number-shaped value');
}

function assertOnlyAllowedProperties(eventName, properties) {
    const allowed = BACKEND_CONTRACT[eventName];
    assert.ok(allowed, `${eventName} must be a known event in the backend contract mirror`);
    for (const key of Object.keys(properties)) {
        assert.ok(allowed.has(key), `${eventName} sent property "${key}" which is NOT in the backend's EVENT_ALLOWED_PROPERTIES and would be silently stripped server-side`);
    }
}

describe('Phase P.1G.3A — frontend/backend contract parity (real acquisitionService)', () => {
    let posted;

    beforeEach(() => {
        posted = [];
        localStorage.clear();
        sessionStorage.clear();
        api.post = async (url, body) => {
            posted.push({ url, body });
            if (url === '/acquisition/telegram-link-session') {
                return { data: { telegram_deep_link: 'https://t.me/Poputkionline_bot?start=w_tok' } };
            }
            return { data: {} };
        };
        acquisitionService.visitorId = null;
        acquisitionService.sessionId = 'test-session-id';
        acquisitionService.sessionData = { session_id: 'test-session-id' };
        acquisitionService._telegramOpenInFlight = null;
    });

    function lastEvent() {
        const call = posted.filter(p => p.url === '/acquisition/events').pop();
        assert.ok(call, 'must have POSTed to /acquisition/events');
        return call.body.events[0];
    }

    it('LANDING_VIEWED: only allowlisted properties, has real business meaning (a path), no PII', async () => {
        acquisitionService.sessionData.landingViewedSent = false;
        await acquisitionService.trackLandingViewed();
        const event = lastEvent();
        assert.equal(event.event_name, 'LANDING_VIEWED');
        assertOnlyAllowedProperties('LANDING_VIEWED', event.properties);
        assert.ok(typeof event.properties.page_path === 'string' && event.properties.page_path.length > 0);
        assertNoPii(event.properties);
    });

    it('ROUTE_SEARCHED: only allowlisted properties, carries the searched route, no PII', async () => {
        await acquisitionService.trackRouteSearched({ from_city_id: 'Москва', to_city_id: 'Казань', travel_date: '2026-09-10' });
        const event = lastEvent();
        assert.equal(event.event_name, 'ROUTE_SEARCHED');
        assertOnlyAllowedProperties('ROUTE_SEARCHED', event.properties);
        assert.equal(event.properties.from_city, 'Москва');
        assert.equal(event.properties.to_city, 'Казань');
        assert.equal(event.properties.departure_date, '2026-09-10');
        assertNoPii(event.properties);
    });

    it('TRIP_VIEWED: only allowlisted properties, carries a real trip_id, no PII', async () => {
        await acquisitionService.trackTripViewed({ bus_ticket_id: 777 });
        const event = lastEvent();
        assert.equal(event.event_name, 'TRIP_VIEWED');
        assertOnlyAllowedProperties('TRIP_VIEWED', event.properties);
        assert.equal(event.properties.trip_id, 777);
        assertNoPii(event.properties);
    });

    it('BOOKING_STARTED: only allowlisted properties, carries a real trip_id, no PII', async () => {
        await acquisitionService.trackBookingStarted({ bus_ticket_id: 888 });
        const event = lastEvent();
        assert.equal(event.event_name, 'BOOKING_STARTED');
        assertOnlyAllowedProperties('BOOKING_STARTED', event.properties);
        assert.equal(event.properties.trip_id, 888);
        assertNoPii(event.properties);
    });

    it('TELEGRAM_OPENED: only allowlisted properties, no raw token/URL, no PII', async () => {
        await acquisitionService.openTelegramBot();
        const event = lastEvent();
        assert.equal(event.event_name, 'TELEGRAM_OPENED');
        assertOnlyAllowedProperties('TELEGRAM_OPENED', event.properties);
        assert.equal(event.properties.target_channel, 'telegram_bot');
        assert.equal(event.properties.handoff_point, 'web_to_telegram_cta');
        assertNoPii(event.properties);
        const str = JSON.stringify(event.properties);
        assert.ok(!str.includes('t.me/'), 'must not leak the deep-link URL');
        assert.ok(!str.includes('w_tok'), 'must not leak the raw handshake token');
    });

    it('SHARE_CLICKED: only allowlisted properties, carries the referral code as target_content, no PII', async () => {
        await acquisitionService.trackShareClicked({ channel: 'telegram', referral_code: 'XYZ789' });
        const event = lastEvent();
        assert.equal(event.event_name, 'SHARE_CLICKED');
        assertOnlyAllowedProperties('SHARE_CLICKED', event.properties);
        assert.equal(event.properties.share_channel, 'telegram');
        assert.equal(event.properties.target_content, 'XYZ789');
        assertNoPii(event.properties);
    });

    it('every one of the six client events sends only backend-allowlisted properties (full sweep)', async () => {
        acquisitionService.sessionData.landingViewedSent = false;
        await acquisitionService.trackLandingViewed();
        await acquisitionService.trackRouteSearched({ from_city_id: 'A', to_city_id: 'B', travel_date: '2026-01-01' });
        await acquisitionService.trackTripViewed({ bus_ticket_id: 1 });
        await acquisitionService.trackBookingStarted({ bus_ticket_id: 1 });
        await acquisitionService.openTelegramBot();
        await acquisitionService.trackShareClicked({ channel: 'copy', referral_code: 'R1' });

        const events = posted.filter(p => p.url === '/acquisition/events').map(p => p.body.events[0]);
        assert.equal(events.length, 6);
        for (const event of events) {
            assertOnlyAllowedProperties(event.event_name, event.properties);
            assertNoPii(event.properties);
        }
        assert.deepEqual(
            events.map(e => e.event_name).sort(),
            ['BOOKING_STARTED', 'LANDING_VIEWED', 'ROUTE_SEARCHED', 'SHARE_CLICKED', 'TELEGRAM_OPENED', 'TRIP_VIEWED']
        );
    });
});
