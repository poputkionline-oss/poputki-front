/**
 * tests/phase_p1g3a_addendum_bus_tab_deeplink.test.js
 *
 * PHASE P.1G.3A ADDENDUM — SearchResultsView ?tab= deep-link handling
 *
 * The Telegram bot's /start button now opens .../search?tab=bus directly
 * (see poputki-bot's acquisitionBotHandler.js). This exercises the REAL
 * SearchResultsView.vue component options (data()) via a real import of its
 * extracted <script> block - not source-string matching - to prove:
 *  - ?tab=bus activates the buses tab (the bus search form's state)
 *  - no ?tab= at all still defaults to buses (pre-existing, unchanged)
 *  - ?tab=rides is still honored (existing behavior preserved)
 *  - an unknown/garbage tab value safely falls back to buses instead of
 *    landing on a value that matches neither the 'rides' nor 'buses'
 *    template branch (a real bug found during this audit: the old
 *    `this.$route.query.tab || 'buses'` accepted ANY truthy string verbatim)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { importVueScript } from './helpers/extractVueScript.mjs';

class MemoryStorage {
    constructor() { this.store = new Map(); }
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
    setItem(key, value) { this.store.set(key, String(value)); }
    removeItem(key) { this.store.delete(key); }
    clear() { this.store.clear(); }
}
globalThis.localStorage = globalThis.localStorage || new MemoryStorage();
globalThis.sessionStorage = globalThis.sessionStorage || new MemoryStorage();
globalThis.window = globalThis.window || { location: { pathname: '/search', search: '', href: 'https://www.poputki.online/search' }, history: { replaceState: () => {} }, open: () => {} };

function resolveActiveTabFor(queryTab, componentOptions) {
    const fakeThis = { $route: { query: queryTab === undefined ? {} : { tab: queryTab } } };
    const data = componentOptions.data.call(fakeThis);
    return data.activeTab;
}

describe('Phase P.1G.3A ADDENDUM — SearchResultsView.vue real ?tab= resolution', () => {
    let SearchResultsView;

    beforeEach(async () => {
        const mod = await importVueScript('src/views/SearchResultsView.vue');
        SearchResultsView = mod.default;
    });

    it('?tab=bus activates the buses tab', () => {
        assert.equal(resolveActiveTabFor('bus', SearchResultsView), 'buses');
    });

    it('no tab query param at all still defaults to buses', () => {
        assert.equal(resolveActiveTabFor(undefined, SearchResultsView), 'buses');
    });

    it('?tab=rides is honored (existing behavior preserved)', () => {
        assert.equal(resolveActiveTabFor('rides', SearchResultsView), 'rides');
    });

    it('an unknown/garbage tab value safely falls back to buses, never an unmatched value', () => {
        assert.equal(resolveActiveTabFor('xyz-not-a-real-tab', SearchResultsView), 'buses');
        assert.equal(resolveActiveTabFor('<script>alert(1)</script>', SearchResultsView), 'buses');
        assert.equal(resolveActiveTabFor('buses', SearchResultsView), 'buses');
    });

    it('the resolved activeTab is always one of the two real template-supported values', () => {
        for (const candidate of ['bus', 'buses', 'rides', undefined, 'foo', '', 'RIDES', 'Bus']) {
            const result = resolveActiveTabFor(candidate, SearchResultsView);
            assert.ok(result === 'rides' || result === 'buses', `resolved "${result}" for input "${candidate}" is not a real tab value`);
        }
    });

    it('the real route (name: search, path: /search) is the one the bot\'s Mini App button targets', async () => {
        const fs = await import('node:fs');
        const src = fs.readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8');
        assert.ok(/path:\s*['"]\/search['"]/.test(src));
        assert.ok(/name:\s*['"]search['"]/.test(src));
    });
});
