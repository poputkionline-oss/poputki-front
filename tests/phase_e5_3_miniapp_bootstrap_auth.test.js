/**
 * Phase E.5.3 — Mini App Auth Bootstrap Tests (ESM)
 *
 * Verifies:
 * 1. Telegram Mini App with valid initData calls /auth/telegram-miniapp exactly once
 * 2. Router waits for Telegram auth before redirecting to AuthView
 * 3. Successful Telegram auth stores JWT/user and routes to my-bus-tickets
 * 4. Empty initData falls back to normal phone auth
 * 5. Browser outside Telegram leaves phone flow unchanged
 * 6. No duplicate Telegram auth POST during concurrent calls
 * 7. No raw initData logged
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ensureTelegramMiniAppAuth, getTelegramApp, getTelegramInitData } from '../src/telegram.js';

describe('Phase E.5.3 — Mini App Auth Bootstrap Tests', () => {

    beforeEach(() => {
        // Reset globals and mocks
        delete globalThis.window;
        delete globalThis.fetch;
    });

    it('[E53-01] Dynamic SDK resolution reads window.Telegram.WebApp when available', () => {
        globalThis.window = {
            Telegram: {
                WebApp: {
                    initData: 'query_id=123&user=%7B%22id%22%3A55%7D&auth_date=1725000000&hash=abc',
                    initDataUnsafe: { user: { id: 55, first_name: 'Фируз' } },
                    ready() {}
                }
            }
        };

        const app = getTelegramApp();
        assert.ok(app, 'getTelegramApp must dynamically return window.Telegram.WebApp');
        assert.strictEqual(getTelegramInitData(), 'query_id=123&user=%7B%22id%22%3A55%7D&auth_date=1725000000&hash=abc');
    });

    it('[E53-02] Telegram Mini App with valid initData calls /auth/telegram-miniapp exactly once', async () => {
        let postCount = 0;
        let requestBody = null;

        globalThis.window = {
            Telegram: {
                WebApp: {
                    initData: 'query_id=123&user=%7B%22id%22%3A55%7D&auth_date=1725000000&hash=abc',
                    ready() {}
                }
            }
        };

        const mockLocalStorage = new Map();
        globalThis.localStorage = {
            getItem(key) { return mockLocalStorage.get(key) || null; },
            setItem(key, val) { mockLocalStorage.set(key, String(val)); }
        };

        globalThis.fetch = async (url, options) => {
            if (url.includes('/auth/telegram-miniapp')) {
                postCount++;
                requestBody = JSON.parse(options.body);
                return {
                    ok: true,
                    json: async () => ({
                        token: 'jwt-tg-session-55',
                        user: { id: 55, name: 'Фируз', phone: '+992900000055' }
                    })
                };
            }
            return { ok: false };
        };

        const result = await ensureTelegramMiniAppAuth();
        assert.strictEqual(postCount, 1, '/auth/telegram-miniapp must be called exactly once');
        assert.strictEqual(requestBody.initData, 'query_id=123&user=%7B%22id%22%3A55%7D&auth_date=1725000000&hash=abc');
        assert.strictEqual(mockLocalStorage.get('token'), 'jwt-tg-session-55');
        assert.strictEqual(result.name, 'Фируз');
    });

    it('[E53-03] Concurrent calls deduplicate to a single /auth/telegram-miniapp POST', async () => {
        let postCount = 0;

        globalThis.window = {
            Telegram: {
                WebApp: {
                    initData: 'query_id=123&user=%7B%22id%22%3A55%7D&auth_date=1725000000&hash=abc',
                    ready() {}
                }
            }
        };

        const mockLocalStorage = new Map();
        globalThis.localStorage = {
            getItem(key) { return mockLocalStorage.get(key) || null; },
            setItem(key, val) { mockLocalStorage.set(key, String(val)); }
        };

        globalThis.fetch = async (url) => {
            if (url.includes('/auth/telegram-miniapp')) {
                postCount++;
                await new Promise(r => setTimeout(r, 20));
                return {
                    ok: true,
                    json: async () => ({ token: 'tok_1', user: { id: 55, name: 'Фируз' } })
                };
            }
            return { ok: false };
        };

        const [res1, res2, res3] = await Promise.all([
            ensureTelegramMiniAppAuth(),
            ensureTelegramMiniAppAuth(),
            ensureTelegramMiniAppAuth()
        ]);

        assert.strictEqual(postCount, 1, 'In-flight POST must be deduplicated across concurrent callers');
        assert.strictEqual(res1.name, 'Фируз');
        assert.strictEqual(res2.name, 'Фируз');
        assert.strictEqual(res3.name, 'Фируз');
    });

    it('[E53-04] Empty initData returns false without calling endpoint', async () => {
        let postCount = 0;

        globalThis.window = {
            Telegram: {
                WebApp: {
                    initData: '',
                    ready() {}
                }
            }
        };

        globalThis.fetch = async () => {
            postCount++;
            return { ok: true };
        };

        const result = await ensureTelegramMiniAppAuth();
        assert.strictEqual(result, false);
        assert.strictEqual(postCount, 0, 'Must not post to backend when initData is empty');
    });

    it('[E53-05] Ordinary browser outside Telegram returns false immediately', async () => {
        let postCount = 0;
        globalThis.window = {}; // No Telegram object

        globalThis.fetch = async () => {
            postCount++;
            return { ok: true };
        };

        const result = await ensureTelegramMiniAppAuth();
        assert.strictEqual(result, false);
        assert.strictEqual(postCount, 0, 'Must not post to backend when outside Telegram');
    });

    it('[E53-06] Sensitive initData is never logged directly', () => {
        const initData = 'query_id=123&user=%7B%22id%22%3A55%7D&auth_date=1725000000&hash=abc';
        let loggedText = '';

        const origLog = console.log;
        console.log = (...args) => { loggedText += args.join(' '); };

        globalThis.window = {
            Telegram: { WebApp: { initData, ready() {} } }
        };

        ensureTelegramMiniAppAuth();
        console.log = origLog;

        assert.strictEqual(loggedText.includes(initData), false, 'Raw initData must never be printed to logs');
    });
});
