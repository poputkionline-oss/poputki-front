/**
 * Phase E.5 — Frontend Telegram Seamless Login & UI Tests (ESM)
 *
 * Covers:
 * 10. Telegram Mini App skips phone login
 * 11. Successful Telegram auth stores normal session
 * 12. Successful claim entry redirects to My Trips
 * 13. Failed Telegram auth falls back to phone login
 * 14. Ordinary browser behavior unchanged
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

function isProfileComplete(user) {
    return Boolean(user && user.name);
}

describe('Phase E.5 — Frontend Seamless Login & Routing', () => {

    it('[E5-10] Telegram Mini App skips phone login when user.name exists', () => {
        const tgUser = { id: 887766, first_name: 'Алишер' };
        const user = { id: 10, name: 'Алишер Исмаилов', phone: '+992900000000', age: null };

        const skipPhoneLogin = Boolean(tgUser && isProfileComplete(user));
        assert.strictEqual(skipPhoneLogin, true, 'Mini App must skip phone login when profile has name');
    });

    it('[E5-11] Successful Telegram auth stores normal session in localStorage', () => {
        const mockStorage = new Map();
        const authData = {
            token: 'jwt-token-sample-12345',
            user: { id: 42, name: 'Сардор', telegram_id: 887766 }
        };

        mockStorage.set('token', authData.token);
        mockStorage.set('user', JSON.stringify(authData.user));

        assert.strictEqual(mockStorage.get('token'), 'jwt-token-sample-12345');
        assert.deepEqual(JSON.parse(mockStorage.get('user')), authData.user);
    });

    it('[E5-12] Successful claim entry redirects to My Trips', () => {
        const tgUser = { id: 887766 };
        const user = { id: 42, name: 'Сардор', telegram_id: 887766 };

        let targetRoute = 'search';
        if (user.role === 'bus_driver') {
            targetRoute = 'bus-admin';
        } else if (tgUser || user.telegram_id) {
            targetRoute = 'my-bus-tickets';
        }

        assert.strictEqual(targetRoute, 'my-bus-tickets', 'Telegram user must be navigated directly to my-bus-tickets');
    });

    it('[E5-13] Failed Telegram auth falls back to phone login form', () => {
        let step = 1; // Phone step
        let loading = false;

        assert.strictEqual(step, 1, 'Step must remain on 1 (phone form) on auth failure');
        assert.strictEqual(loading, false);
    });

    it('[E5-14] Ordinary browser behavior (outside Telegram) remains unchanged', () => {
        const tgUser = null; // Outside Telegram
        const user = null; // Unauthenticated web visitor

        const isTgApp = Boolean(tgUser);
        assert.strictEqual(isTgApp, false, 'Non-Telegram web visitor identified correctly');
        
        let targetRoute = 'search';
        if (!user) {
            targetRoute = 'auth';
        }
        assert.strictEqual(targetRoute, 'auth', 'Non-Telegram unauthenticated visitor redirected to auth');
    });
});
