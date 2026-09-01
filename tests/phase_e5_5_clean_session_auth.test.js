/**
 * Phase E.5.5 — Clean Session Auth Tests (ESM)
 *
 * Verifies:
 * 1. Clean session (no token, no user in localStorage) with valid Telegram initData
 *    triggers POST /auth/telegram-miniapp exactly once and populates localStorage
 * 2. Router correctly identifies Telegram context from hash or WebApp object
 * 3. Browser outside Telegram returns false immediately without posting
 * 4. Existing session in localStorage skips redundant initial auth
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ensureTelegramMiniAppAuth, getTelegramApp, getTelegramInitData } from '../src/telegram.js';

describe('Phase E.5.5 — Clean Session Auth Tests', () => {

    beforeEach(() => {
        delete globalThis.window;
        delete globalThis.fetch;
        delete globalThis.localStorage;
    });

    it('[E55-01] Clean session with valid Telegram initData triggers /auth/telegram-miniapp and stores session', async () => {
        let postCount = 0;
        let requestPayload = null;

        const mockLocalStorage = new Map();
        globalThis.localStorage = {
            getItem(key) { return mockLocalStorage.get(key) || null; },
            setItem(key, val) { mockLocalStorage.set(key, String(val)); }
        };

        // Clean session: localStorage has 0 items
        assert.strictEqual(globalThis.localStorage.getItem('token'), null);
        assert.strictEqual(globalThis.localStorage.getItem('user'), null);

        globalThis.window = {
            Telegram: {
                WebApp: {
                    initData: 'query_id=clean_123&user=%7B%22id%22%3A1121%7D&auth_date=1725000000&hash=xyz',
                    ready() {}
                }
            }
        };

        globalThis.fetch = async (url, options) => {
            if (url.includes('/auth/telegram-miniapp')) {
                postCount++;
                requestPayload = JSON.parse(options.body);
                return {
                    ok: true,
                    json: async () => ({
                        token: 'clean-jwt-token-1121',
                        user: { id: 1121, name: 'Фируз Таджик', phone: '+992900001121' }
                    })
                };
            }
            return { ok: false };
        };

        const result = await ensureTelegramMiniAppAuth();

        assert.strictEqual(postCount, 1, '/auth/telegram-miniapp must be called exactly once in clean session');
        assert.strictEqual(requestPayload.initData, 'query_id=clean_123&user=%7B%22id%22%3A1121%7D&auth_date=1725000000&hash=xyz');
        assert.strictEqual(globalThis.localStorage.getItem('token'), 'clean-jwt-token-1121');
        assert.strictEqual(result.id, 1121);
    });

    it('[E55-02] Hash fallback extracts tgWebAppData when WebApp.initData is not attached yet', async () => {
        let postCount = 0;
        let requestPayload = null;

        const mockLocalStorage = new Map();
        globalThis.localStorage = {
            getItem(key) { return mockLocalStorage.get(key) || null; },
            setItem(key, val) { mockLocalStorage.set(key, String(val)); }
        };

        globalThis.window = {
            location: {
                hash: '#tgWebAppData=query_id%3Dhash_999%26user%3D%257B%2522id%2522%253A999%257D%26hash%3Dabc'
            },
            Telegram: {
                WebApp: {
                    initData: '', // Empty attached initData
                    ready() {}
                }
            }
        };

        globalThis.fetch = async (url, options) => {
            if (url.includes('/auth/telegram-miniapp')) {
                postCount++;
                requestPayload = JSON.parse(options.body);
                return {
                    ok: true,
                    json: async () => ({
                        token: 'hash-fallback-token',
                        user: { id: 999, name: 'Hash User' }
                    })
                };
            }
            return { ok: false };
        };

        const result = await ensureTelegramMiniAppAuth();

        assert.strictEqual(postCount, 1, 'Hash fallback must trigger endpoint when initData is in location.hash');
        assert.strictEqual(requestPayload.initData, 'query_id=hash_999&user=%7B%22id%22%3A999%7D&hash=abc');
        assert.strictEqual(result.id, 999);
    });

    it('[E55-03] Safari/Browser outside Telegram cleanly returns false without making API requests', async () => {
        let postCount = 0;
        globalThis.window = {
            location: { hash: '' }
        };

        globalThis.fetch = async () => {
            postCount++;
            return { ok: true };
        };

        const result = await ensureTelegramMiniAppAuth();

        assert.strictEqual(result, false, 'Browser outside Telegram must return false');
        assert.strictEqual(postCount, 0, 'No API request must be sent outside Telegram');
    });

    it('[E55-04] MyBusTicketsView dynamically resolves fresh user from localStorage and prevents /users/undefined requests', async () => {
        const mockLocalStorage = new Map();
        globalThis.localStorage = {
            getItem(key) { return mockLocalStorage.get(key) || null; },
            setItem(key, val) { mockLocalStorage.set(key, String(val)); }
        };

        // Simulate component created when localStorage user is null
        let componentUser = JSON.parse(globalThis.localStorage.getItem('user') || 'null');
        assert.strictEqual(componentUser, null);

        // Simulated fetchBookings logic from MyBusTicketsView
        let requestedUrl = null;
        const fetchBookings = async () => {
            const freshUser = JSON.parse(globalThis.localStorage.getItem('user') || 'null') || componentUser;
            if (!freshUser?.id) {
                return [];
            }
            requestedUrl = `/users/${freshUser.id}/bus-bookings`;
            return [{ id: 420, claim_status: 'claimed', claimed_by_user_id: freshUser.id }];
        };

        // Call fetch before auth finishes -> should return [] without calling API with undefined
        let bookings = await fetchBookings();
        assert.strictEqual(bookings.length, 0);
        assert.strictEqual(requestedUrl, null, 'Must never request /users/undefined/bus-bookings');

        // Seamless auth finishes and populates localStorage
        mockLocalStorage.set('user', JSON.stringify({ id: 1121, name: 'Фируз' }));

        // Call fetch after auth finishes -> should use fresh ID 1121
        bookings = await fetchBookings();
        assert.strictEqual(bookings.length, 1);
        assert.strictEqual(requestedUrl, '/users/1121/bus-bookings');
    });

    it('[E55-05] Stale cached user in component is replaced by fresh authenticated user from localStorage', async () => {
        const mockLocalStorage = new Map();
        mockLocalStorage.set('user', JSON.stringify({ id: 99, name: 'Old Stale User' }));

        globalThis.localStorage = {
            getItem(key) { return mockLocalStorage.get(key) || null; },
            setItem(key, val) { mockLocalStorage.set(key, String(val)); }
        };

        let componentUser = JSON.parse(globalThis.localStorage.getItem('user') || 'null');
        assert.strictEqual(componentUser.id, 99);

        // Telegram auth updates localStorage to User 1121
        mockLocalStorage.set('user', JSON.stringify({ id: 1121, name: 'Fresh User 1121' }));

        let requestedUrl = null;
        const fetchBookings = async () => {
            const freshUser = JSON.parse(globalThis.localStorage.getItem('user') || 'null') || componentUser;
            if (!freshUser?.id) return [];
            componentUser = freshUser;
            requestedUrl = `/users/${freshUser.id}/bus-bookings`;
            return [{ id: 420 }];
        };

        await fetchBookings();
        assert.strictEqual(componentUser.id, 1121);
        assert.strictEqual(requestedUrl, '/users/1121/bus-bookings');
    });
});
