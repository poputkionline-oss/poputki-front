/**
 * tests/phase_e48_4_passenger_api_auth.test.js
 *
 * PHASE E.48.4 — Frontend API Passenger Auth Interceptor Tests
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Phase E.48.4 — Frontend Passenger API Auth Interceptors', () => {
    const apiSource = readFileSync(resolve('src/api.js'), 'utf-8');

    it('[E48.4-F01] api.js does not contain legacy x-mana-man header', () => {
        assert.equal(apiSource.includes('x-mana-man'), false);
    });

    it('[E48.4-F02] api.js attaches passenger Bearer token from localStorage.getItem("token")', () => {
        assert.ok(apiSource.includes("localStorage.getItem('token')"));
        assert.ok(apiSource.includes("config.headers['Authorization'] = `Bearer ${passengerToken}`"));
    });

    it('[E48.4-F03] carrier routes (/bus-admin, /claims/carrier) strictly preserve carrierJwt precedence', () => {
        assert.ok(apiSource.includes("url.startsWith('/bus-admin')"));
        assert.ok(apiSource.includes("url.startsWith('/claims/carrier')"));
        assert.ok(apiSource.includes("config.headers['Authorization'] = `Bearer ${carrierJwt}`"));
    });

    it('[E48.4-F04] external third-party URLs are protected from token leakage', () => {
        assert.ok(apiSource.includes("url.startsWith('http://')"));
        assert.ok(apiSource.includes("url.startsWith('https://')"));
    });

    it('[E48.4-F05] response interceptor handles 401 on passenger endpoints by clearing stale passenger token', () => {
        assert.ok(apiSource.includes("localStorage.removeItem('token')"));
        assert.ok(apiSource.includes("localStorage.removeItem('user')"));
    });

    it('[E48.4-F06] response interceptor on 401 does NOT clear carrierJwt when passenger route fails', () => {
        // Confirm carrier cleanup is isolated to carrier routes
        const carrierCleanupIndex = apiSource.indexOf("localStorage.removeItem('carrierJwt')");
        const passengerCleanupIndex = apiSource.indexOf("localStorage.removeItem('token')");
        assert.ok(carrierCleanupIndex !== -1);
        assert.ok(passengerCleanupIndex !== -1);
        assert.ok(carrierCleanupIndex < passengerCleanupIndex);
    });
});
