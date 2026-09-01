/**
 * Phase E.10 — Telegram Mini App Entrypoint Consistency UI & Auth Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase E.10 — Entrypoint Consistency & Sync Tests', () => {

    const routerPath = path.resolve(__dirname, '../src/router/index.js');
    const routerContent = fs.readFileSync(routerPath, 'utf-8');

    it('[E10-F01] router.beforeEach always awaits ensureTelegramMiniAppAuth in Telegram context', () => {
        assert.ok(routerContent.includes('await ensureTelegramMiniAppAuth()'), 'Must await ensureTelegramMiniAppAuth in router guard');
        assert.strictEqual(routerContent.includes('// Background sync\n            ensureTelegramMiniAppAuth()'), false, 'Must not use un-awaited background sync');
    });

    it('[E10-F02] Both inline button and system menu entrypoints pass through Telegram auth guard', () => {
        assert.ok(routerContent.includes('isTelegramContext'), 'Must check Telegram context for all entrypoints');
        assert.ok(routerContent.includes('tgWebAppData'), 'Must support location.hash tgWebAppData fallback');
    });

    it('[E10-F03] Stale local session is replaced with fresh Telegram user', () => {
        const tgPath = path.resolve(__dirname, '../src/telegram.js');
        const tgContent = fs.readFileSync(tgPath, 'utf-8');

        assert.ok(tgContent.includes("localStorage.setItem('user', JSON.stringify(data.user))"), 'Must update localStorage.user with returned Telegram user');
        assert.ok(tgContent.includes("localStorage.setItem('token', data.token)"), 'Must update localStorage.token with fresh JWT');
    });
});
