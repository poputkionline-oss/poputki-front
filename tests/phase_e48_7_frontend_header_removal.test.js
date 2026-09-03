/**
 * tests/phase_e48_7_frontend_header_removal.test.js
 *
 * PHASE E.48.7 — Frontend Legacy Header Removal Verification Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Phase E.48.7 — Frontend Legacy Header Removal', () => {
    const apiSource = readFileSync(resolve('src/api.js'), 'utf-8');
    const telegramSource = readFileSync(resolve('src/telegram.js'), 'utf-8');

    it('[E48.7-F01] api.js does NOT inject or default x-mana-man header', () => {
        assert.equal(apiSource.includes('x-mana-man'), false);
        assert.equal(apiSource.includes('nasa.2006'), false);
    });

    it('[E48.7-F02] api.js preserves passenger Bearer token attachment', () => {
        assert.ok(apiSource.includes("localStorage.getItem('token')"));
        assert.ok(apiSource.includes("config.headers['Authorization'] = `Bearer ${passengerToken}`"));
    });

    it('[E48.7-F03] api.js preserves carrierJwt attachment on carrier routes', () => {
        assert.ok(apiSource.includes("url.startsWith('/bus-admin')"));
        assert.ok(apiSource.includes("url.startsWith('/claims/carrier')"));
        assert.ok(apiSource.includes("config.headers['Authorization'] = `Bearer ${carrierJwt}`"));
    });

    it('[E48.7-F04] api.js preserves X-Admin-Token on admin routes', () => {
        assert.ok(apiSource.includes("config.headers['X-Admin-Token'] = adminToken"));
    });

    it('[E48.7-F05] telegram.js does NOT send x-mana-man header on telegram-miniapp auth', () => {
        assert.equal(telegramSource.includes('x-mana-man'), false);
        assert.equal(telegramSource.includes('nasa.2006'), false);
    });
});
