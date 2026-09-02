/**
 * phase_a_contact_role_ui.test.js — Frontend UI test suite for Phase A & A.1 Contact Role & Ownership
 * POPUTKI.ONLINE
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('MANUAL BOOKING PASSENGER ACTIVATION V1 — PHASE A.1 FRONTEND UI TESTS', () => {

    it('1. BusAdminView.vue no longer exposes a Contact Role selector in the manual booking form (Phase E.45)', () => {
        const busAdminVue = readFileSync(resolve('src/views/BusAdminView.vue'), 'utf-8');
        assert.ok(!busAdminVue.includes('Контакт принадлежит'), 'Contact-role selector label must be removed');
        assert.ok(!busAdminVue.includes('Пассажиру'), 'passenger radio label must be removed');
        assert.ok(!busAdminVue.includes('Семье / группе'), 'family_or_group radio label must be removed');
        assert.ok(!busAdminVue.includes('Посреднику'), 'coordinator radio label must be removed');
        assert.ok(!busAdminVue.includes('Не знаю'), 'unknown radio label must be removed');
        assert.ok(!busAdminVue.includes('v-model="bookingForm.contact_role"'), 'no input may bind directly to contact_role anymore');
        assert.ok(!busAdminVue.includes('value="family_or_group"'), 'no radio input for family_or_group may remain');
    });

    it('2. BusAdminView.vue initializes contact_role to unknown by default', () => {
        const busAdminVue = readFileSync(resolve('src/views/BusAdminView.vue'), 'utf-8');
        assert.ok(busAdminVue.includes("contact_role: 'unknown'"));
    });

    it('3. BusAdminView.vue sends cleanPhone or null without legacy em-dash fallback', () => {
        const busAdminVue = readFileSync(resolve('src/views/BusAdminView.vue'), 'utf-8');
        assert.ok(busAdminVue.includes('cleanPhone'));
        assert.ok(busAdminVue.includes("contact_role: f.contact_role || 'unknown'"));
        // Confirm hardcoded '—' fallback on phone submit is eliminated
        assert.ok(!busAdminVue.includes("phone: firstP.phone || '—'"));
    });

    it('4. PassengerTicket.vue retains Ticket Design V1.1 structure and layout', () => {
        const ticketVue = readFileSync(resolve('src/components/ticket/PassengerTicket.vue'), 'utf-8');
        assert.ok(ticketVue.includes('POPUTKI.ONLINE'));
        assert.ok(ticketVue.includes('ПОЕЗДКИ С ДОВЕРИЕМ'));
        assert.ok(ticketVue.includes('ЭЛЕКТРОННЫЙ БИЛЕТ / МАРШРУТНЫЙ ЛИСТ'));
        assert.ok(ticketVue.includes('Билет №'));
    });
});
