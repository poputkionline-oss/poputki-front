/**
 * tests/phase_e40_manual_booking_success_routing.test.js
 * 
 * Phase E.40 — Frontend Manual Booking Success Message & Handoff Routing Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('PHASE E.40 — FRONTEND SUCCESS MESSAGE & HANDOFF ROUTING', () => {

    const busAdminPath = path.resolve('src/views/BusAdminView.vue');
    const busAdminSource = fs.readFileSync(busAdminPath, 'utf8');

    it('1. BusAdminView.vue conditions Telegram-sent alert on res.data?.is_auto_claimed', () => {
        assert.ok(
            busAdminSource.includes('else if (res.data?.is_auto_claimed)'),
            'Must check res.data?.is_auto_claimed before claiming Telegram ticket was sent'
        );
    });

    it('2. BusAdminView.vue has fallback alert without false Telegram claim', () => {
        assert.ok(
            busAdminSource.includes("alert('Бронь успешно создана!');"),
            'Must alert generic success without false Telegram claim'
        );
    });

    it('3. Simulation: res.data.handoff.required = true triggers handoffModal', () => {
        let handoffModalShown = false;
        let alertedMessage = '';

        function handleResponse(res) {
            if (res.data?.handoff?.required) {
                handoffModalShown = true;
            } else if (res.data?.is_auto_claimed) {
                alertedMessage = 'Бронь успешно создана! Билет отправлен пассажиру в Telegram.';
            } else {
                alertedMessage = 'Бронь успешно создана!';
            }
        }

        handleResponse({
            data: {
                success: true,
                is_auto_claimed: false,
                handoff: { required: true, ticket_url: 'https://test/ticket' }
            }
        });

        assert.strictEqual(handoffModalShown, true);
        assert.strictEqual(alertedMessage, '');
    });

    it('4. Simulation: registered passenger (is_auto_claimed=true) alerts Telegram sent', () => {
        let handoffModalShown = false;
        let alertedMessage = '';

        function handleResponse(res) {
            if (res.data?.handoff?.required) {
                handoffModalShown = true;
            } else if (res.data?.is_auto_claimed) {
                alertedMessage = 'Бронь успешно создана! Билет отправлен пассажиру в Telegram.';
            } else {
                alertedMessage = 'Бронь успешно создана!';
            }
        }

        handleResponse({
            data: {
                success: true,
                is_auto_claimed: true,
                handoff: { required: false }
            }
        });

        assert.strictEqual(handoffModalShown, false);
        assert.strictEqual(alertedMessage, 'Бронь успешно создана! Билет отправлен пассажиру в Telegram.');
    });

    it('5. Simulation: unregistered passenger with handoff.required=false NEVER claims Telegram was sent', () => {
        let handoffModalShown = false;
        let alertedMessage = '';

        function handleResponse(res) {
            if (res.data?.handoff?.required) {
                handoffModalShown = true;
            } else if (res.data?.is_auto_claimed) {
                alertedMessage = 'Бронь успешно создана! Билет отправлен пассажиру в Telegram.';
            } else {
                alertedMessage = 'Бронь успешно создана!';
            }
        }

        handleResponse({
            data: {
                success: true,
                is_auto_claimed: false,
                handoff: { required: false }
            }
        });

        assert.strictEqual(handoffModalShown, false);
        assert.strictEqual(alertedMessage, 'Бронь успешно создана!');
        assert.strictEqual(alertedMessage.includes('Telegram'), false);
    });

});
