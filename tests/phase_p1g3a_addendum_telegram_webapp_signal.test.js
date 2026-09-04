/**
 * tests/phase_p1g3a_addendum_telegram_webapp_signal.test.js
 *
 * PHASE P.1G.3A ADDENDUM — is_telegram_webapp session signal
 *
 * Exercises the real acquisitionService.initSession() against a mocked
 * api.post, proving the outgoing /acquisition/session payload correctly
 * reflects whether window.Telegram.WebApp is present - the client-asserted
 * signal the backend's resolveAttribution() uses (see
 * poputki-backend/tests/phase_p1g3a_addendum_telegram_attribution.test.js)
 * to record source_platform=telegram for Mini-App-opened sessions that have
 * no stronger attribution signal.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
    constructor() { this.store = new Map(); }
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
    setItem(key, value) { this.store.set(key, String(value)); }
    removeItem(key) { this.store.delete(key); }
    clear() { this.store.clear(); }
}
globalThis.localStorage = globalThis.localStorage || new MemoryStorage();
globalThis.sessionStorage = globalThis.sessionStorage || new MemoryStorage();
globalThis.window = globalThis.window || {};
globalThis.window.location = { pathname: '/search', search: '', href: 'https://www.poputki.online/search?tab=bus' };
globalThis.window.history = { replaceState: () => {} };

const api = (await import('../src/api.js')).default;
const acquisitionService = (await import('../src/services/acquisitionService.js')).default;

describe('Phase P.1G.3A ADDENDUM — is_telegram_webapp session signal', () => {
    let posted;

    beforeEach(() => {
        posted = [];
        localStorage.clear();
        sessionStorage.clear();
        acquisitionService.visitorId = null;
        acquisitionService.sessionId = null;
        acquisitionService.sessionData = null;
        acquisitionService.initPromise = null;
        api.post = async (url, body) => {
            posted.push({ url, body });
            if (url === '/acquisition/session') {
                return { data: { success: true, data: { session_id: 'test-session-id', source_platform: 'telegram' } } };
            }
            return { data: {} };
        };
    });

    it('sends is_telegram_webapp: true when window.Telegram.WebApp is present (opened via the bot Mini App button)', async () => {
        window.Telegram = { WebApp: { ready: () => {}, expand: () => {}, initData: '', initDataUnsafe: {} } };
        await acquisitionService.initSession();

        const call = posted.find(p => p.url === '/acquisition/session');
        assert.ok(call, 'must POST to /acquisition/session');
        assert.equal(call.body.is_telegram_webapp, true);
    });

    it('sends is_telegram_webapp: false in a normal browser session (no window.Telegram)', async () => {
        delete window.Telegram;
        await acquisitionService.initSession();

        const call = posted.find(p => p.url === '/acquisition/session');
        assert.ok(call);
        assert.equal(call.body.is_telegram_webapp, false);
    });

    it('never sends any raw Telegram initData alongside the signal (boolean only, zero PII)', async () => {
        window.Telegram = { WebApp: { ready: () => {}, expand: () => {}, initData: 'query_id=SUPER_SECRET&user=%7B%22id%22%3A123%7D', initDataUnsafe: { user: { id: 123 } } } };
        await acquisitionService.initSession();

        const call = posted.find(p => p.url === '/acquisition/session');
        const bodyStr = JSON.stringify(call.body);
        assert.ok(!bodyStr.includes('SUPER_SECRET'));
        assert.ok(!bodyStr.includes('query_id'));
        assert.equal(typeof call.body.is_telegram_webapp, 'boolean');
    });
});
