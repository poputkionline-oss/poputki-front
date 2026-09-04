/**
 * tests/phase_p1g5b_addendum_init_session_real_dedup.test.js
 *
 * PHASE P.1G.5B ADDENDUM — real behavioral proof of initSession() dedup
 *
 * The existing phase_p1g5b_frontend_attribution_continuity.test.js proves
 * the dedup pattern works only against a hand-rolled MockAcquisitionService
 * class that reimplements the same logic - it never actually calls the real
 * src/services/acquisitionService.js, so a real regression in that file
 * (e.g. clearing initPromise before the await, or dropping the finally)
 * would not be caught by it. This file exercises the REAL singleton
 * directly, simulating the real scenario: App.vue's root mounted() hook and
 * SearchResultsView.vue's mounted() hook both calling initSession() on the
 * same tick for a direct /search?tab=bus&acq_token=... landing.
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
globalThis.window = globalThis.window || { location: { pathname: '/', search: '', href: 'https://www.poputki.online/' }, history: { replaceState: () => {} } };
globalThis.document = globalThis.document || { title: 'Test', referrer: '' };

const api = (await import('../src/api.js')).default;
const acquisitionService = (await import('../src/services/acquisitionService.js')).default;

function resetService() {
    acquisitionService.visitorId = null;
    acquisitionService.sessionId = null;
    acquisitionService.sessionData = null;
    acquisitionService.initialized = false;
    acquisitionService.initPromise = null;
    localStorage.clear();
    sessionStorage.clear();
}

describe('Phase P.1G.5B ADDENDUM — real acquisitionService.initSession() concurrent-call dedup', () => {
    let posted, replaceStateCalls;

    beforeEach(() => {
        resetService();
        posted = [];
        replaceStateCalls = [];
        window.location = {
            pathname: '/search',
            search: '?tab=bus&acq_token=REAL_CAMPAIGN_TOKEN_789',
            href: 'https://www.poputki.online/search?tab=bus&acq_token=REAL_CAMPAIGN_TOKEN_789'
        };
        window.history = {
            // Mirrors real browser behavior: replaceState actually updates
            // the visible location, so a later read of window.location.search
            // reflects the scrub - matters for the "reuse existing session"
            // check in acquisitionService.initSession(), which re-reads the
            // URL on every call.
            replaceState: (state, title, newUrl) => {
                replaceStateCalls.push([state, title, newUrl]);
                const parsed = new URL(newUrl, window.location.href);
                window.location.pathname = parsed.pathname;
                window.location.search = parsed.search;
                window.location.href = parsed.href;
            }
        };
        api.post = async (url, body) => {
            posted.push({ url, body });
            if (url === '/acquisition/session') {
                return { data: { success: true, data: { session_id: 'real-session-abc', source_platform: 'instagram' } } };
            }
            return { data: {} };
        };
    });

    it('App.vue (root mount) and SearchResultsView.vue (direct /search landing) calling initSession() on the same tick produce exactly one session request', async () => {
        const [fromApp, fromSearchResultsView] = await Promise.all([
            acquisitionService.initSession(),
            acquisitionService.initSession()
        ]);

        const sessionCalls = posted.filter(p => p.url === '/acquisition/session');
        assert.equal(sessionCalls.length, 1, 'exactly one POST /acquisition/session must be sent for two concurrent callers');
        assert.equal(fromApp, 'real-session-abc');
        assert.equal(fromSearchResultsView, 'real-session-abc');
        assert.equal(fromApp, fromSearchResultsView, 'both real callers must resolve to the exact same session_id');
    });

    it('produces exactly one LANDING_VIEWED event for two concurrent callers', async () => {
        await Promise.all([
            acquisitionService.initSession(),
            acquisitionService.initSession()
        ]);

        const landingViewedEvents = posted.filter(p =>
            p.url === '/acquisition/events' &&
            p.body.events?.[0]?.event_name === 'LANDING_VIEWED'
        );
        assert.equal(landingViewedEvents.length, 1, 'exactly one LANDING_VIEWED must be recorded, not one per caller');
    });

    it('the single session request preserves the real campaign attribution token captured from the URL', async () => {
        await Promise.all([
            acquisitionService.initSession(),
            acquisitionService.initSession()
        ]);

        const sessionCall = posted.find(p => p.url === '/acquisition/session');
        assert.equal(sessionCall.body.tracked_token, 'REAL_CAMPAIGN_TOKEN_789', 'campaign attribution must not be lost to the concurrent-call race');
    });

    it('a third call after successful initialization reuses the existing session instead of firing a new request', async () => {
        await acquisitionService.initSession();
        const countAfterFirst = posted.filter(p => p.url === '/acquisition/session').length;
        assert.equal(countAfterFirst, 1);

        const third = await acquisitionService.initSession();
        const countAfterThird = posted.filter(p => p.url === '/acquisition/session').length;
        assert.equal(countAfterThird, 1, 'a call after successful init must reuse the stored session, not fire a second request');
        assert.equal(third, 'real-session-abc');
    });

    it('a failed session request clears the in-flight guard and allows a real retry to succeed', async () => {
        let callCount = 0;
        api.post = async (url) => {
            callCount++;
            if (url === '/acquisition/session') {
                throw new Error('simulated network failure');
            }
            return { data: {} };
        };

        const first = await acquisitionService.initSession();
        assert.equal(first, null, 'a failed init must resolve to null, not hang or throw past the caller');
        assert.equal(acquisitionService.initPromise, null, 'initPromise must be cleared after a failure to permit retry');

        // Now simulate the retry succeeding for real.
        api.post = async (url, body) => {
            posted.push({ url, body });
            if (url === '/acquisition/session') {
                return { data: { success: true, data: { session_id: 'retry-session-xyz' } } };
            }
            return { data: {} };
        };

        const retry = await acquisitionService.initSession();
        assert.equal(retry, 'retry-session-xyz', 'a retry after failure must be able to succeed for real');
    });

    it('the acq_token is scrubbed from the visible URL only after it was already captured into the outgoing request', async () => {
        await Promise.all([
            acquisitionService.initSession(),
            acquisitionService.initSession()
        ]);

        const sessionCall = posted.find(p => p.url === '/acquisition/session');
        assert.equal(sessionCall.body.tracked_token, 'REAL_CAMPAIGN_TOKEN_789', 'token must have been captured before any scrub');
        assert.ok(replaceStateCalls.length > 0, 'history.replaceState must have been called to scrub the address bar');
        const [, , scrubbedUrl] = replaceStateCalls[0];
        assert.ok(!scrubbedUrl.includes('acq_token'), 'the scrubbed URL must not retain acq_token');
        assert.ok(scrubbedUrl.includes('tab=bus'), 'non-attribution query params (tab=bus) must be preserved');
    });
});
