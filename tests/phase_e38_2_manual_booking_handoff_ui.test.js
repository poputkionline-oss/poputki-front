/**
 * tests/phase_e38_2_manual_booking_handoff_ui.test.js
 * 
 * Phase E.38.2 — Frontend Manual Booking Handoff UI Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('PHASE E.38.2 — MANUAL BOOKING HANDOFF FRONTEND UI', () => {

    const busAdminPath = path.resolve('src/views/BusAdminView.vue');
    const busAdminSource = fs.readFileSync(busAdminPath, 'utf8');

    it('1. BusAdminView has handoffModal state in data()', () => {
        assert.ok(busAdminSource.includes('handoffModal: {'), 'Must define handoffModal in data');
        assert.ok(busAdminSource.includes("copyFeedback: ''"), 'Must include copyFeedback');
        assert.ok(busAdminSource.includes('regenerating: false'), 'Must include regenerating flag');
    });

    it('2. BusAdminView modal contains title "Бронь создана"', () => {
        assert.ok(busAdminSource.includes('Бронь создана'), 'Must display Бронь создана in modal header');
    });

    it('3. BusAdminView implements exact role-specific handoff messages', () => {
        assert.ok(busAdminSource.includes('getHandoffRoleMessage(role)'), 'Must implement getHandoffRoleMessage');
        assert.ok(busAdminSource.includes('Пассажир пока не подключён к Telegram-боту POPUTKI.ONLINE'), 'Passenger message required');
        assert.ok(busAdminSource.includes('Передайте билеты членам семьи / группы'), 'Family/group message required');
        assert.ok(busAdminSource.includes('Передайте билет посреднику для отправки пассажиру'), 'Coordinator message required');
        assert.ok(busAdminSource.includes('Контакт пассажира не подтверждён'), 'Unknown message required');
    });

    it('4. BusAdminView contains required UI copy and open actions', () => {
        assert.ok(busAdminSource.includes('Скопировать ссылку на билет'), 'Action A required');
        assert.ok(busAdminSource.includes('Скопировать ссылку для Telegram'), 'Action B required');
        assert.ok(busAdminSource.includes('Открыть билет'), 'Action C required');
    });

    it('5. BusAdminView handles expiration and already-claimed states', () => {
        assert.ok(busAdminSource.includes('Ссылка для получения поездки истекла.'), 'Expired banner required');
        assert.ok(busAdminSource.includes('Поездка уже подтверждена пассажиром'), 'Claimed state message required');
        assert.ok(busAdminSource.includes('regenerateHandoffClaimLink'), 'Regeneration method required');
        assert.ok(busAdminSource.includes('/claim-link'), 'Must call claim-link endpoint');
    });

    it('6. submitManualBooking triggers handoffModal if handoff.required is true', () => {
        assert.ok(busAdminSource.includes('res.data?.handoff?.required'), 'Must check res.data.handoff.required');
        assert.ok(busAdminSource.includes('this.handoffModal = {'), 'Must populate handoffModal');
    });

});
