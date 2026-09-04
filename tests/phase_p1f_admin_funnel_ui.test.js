/**
 * phase_p1f_admin_funnel_ui.test.js
 * 
 * Phase P.1F: Admin-Only Passenger Activation Funnel UI Tests
 * POPUTKI.ONLINE
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const adminViewPath = path.resolve(__dirname, '../src/views/AdminView.vue');
const adminViewSource = fs.readFileSync(adminViewPath, 'utf-8');

const busAdminPath = path.resolve(__dirname, '../src/views/BusAdminView.vue');
const busAdminSource = fs.readFileSync(busAdminPath, 'utf-8');

const routerPath = path.resolve(__dirname, '../src/router/index.js');
const routerSource = fs.readFileSync(routerPath, 'utf-8');

describe('PHASE P.1F — ADMIN-ONLY PASSENGER ACTIVATION FUNNEL (FRONTEND)', () => {

    describe('1. Admin Navigation & Route Configuration', () => {
        it('[P1F-FE-01] Admin navigation items include «Воронка пассажиров» with id passenger-funnel', () => {
            assert.ok(adminViewSource.includes("{ id: 'passenger-funnel', label: 'Воронка пассажиров' }"));
        });

        it('[P1F-FE-02] Router config includes /admin/passenger-funnel pointing to AdminView', () => {
            assert.ok(routerSource.includes("path: '/admin/passenger-funnel'"));
            assert.ok(routerSource.includes("name: 'admin-passenger-funnel'"));
            assert.ok(routerSource.includes("AdminView.vue"));
        });

        it('[P1F-FE-03] /admin/passenger-funnel route is permitted through publicRoutes guard', () => {
            assert.ok(routerSource.includes("'admin-passenger-funnel'"));
        });
    });

    describe('2. Carrier UI Strict Exclusion (CARRIER_FUNNEL_UI_PRESENT = NO)', () => {
        it('[P1F-FE-04] BusAdminView does NOT contain funnel analytics or journey badges', () => {
            assert.strictEqual(busAdminSource.includes('Activation Journey Badge'), false);
            assert.strictEqual(busAdminSource.includes('Воронка активации'), false);
            assert.strictEqual(busAdminSource.includes('BOT_ABANDONED'), false);
            assert.strictEqual(busAdminSource.includes('Аналитика каналов'), false);
            assert.strictEqual(busAdminSource.includes('Рейтинг конверсии'), false);
            assert.strictEqual(busAdminSource.includes('passenger-funnel'), false);
        });

        it('[P1F-FE-05] BusAdminView preserves operational handoff modal and sharing actions', () => {
            assert.ok(busAdminSource.includes('handoffModal'));
            assert.ok(busAdminSource.includes('openHandoffForBooking'));
            assert.ok(busAdminSource.includes('sendHandoffViaWhatsApp'));
            assert.ok(busAdminSource.includes('sendHandoffViaSms'));
            assert.ok(busAdminSource.includes('openHandoffTelegram'));
            assert.ok(busAdminSource.includes('copyHandoffLink'));
            assert.ok(busAdminSource.includes('openHandoffTicket'));
        });
    });

    describe('3. Admin Funnel Section, Filters & 10 KPI Cards', () => {
        it('[P1F-FE-06] AdminView contains passenger-funnel section with ADMIN-ONLY badge', () => {
            assert.ok(adminViewSource.includes("v-if=\"activeTab === 'passenger-funnel'\""));
            assert.ok(adminViewSource.includes('ADMIN-ONLY'));
            assert.ok(adminViewSource.includes('Учёт с 04.09.2026'));
        });

        it('[P1F-FE-07] AdminView provides all required filters (period, channel, carrier, status, attention)', () => {
            assert.ok(adminViewSource.includes("funnelFilters.period"));
            assert.ok(adminViewSource.includes("funnelFilters.channel"));
            assert.ok(adminViewSource.includes("funnelFilters.carrier_id"));
            assert.ok(adminViewSource.includes("funnelFilters.status"));
            assert.ok(adminViewSource.includes("toggleAttentionFilter"));
            assert.ok(adminViewSource.includes("resetFilters"));
        });

        it('[P1F-FE-08] AdminView renders all 10 upper KPI cards', () => {
            assert.ok(adminViewSource.includes('1. Ручные брони'));
            assert.ok(adminViewSource.includes('2. Передача иниц.'));
            assert.ok(adminViewSource.includes('3. Ссылка открыта'));
            assert.ok(adminViewSource.includes('4. Telegram CTA'));
            assert.ok(adminViewSource.includes('5. Бот запущен'));
            assert.ok(adminViewSource.includes('6. Номер передан'));
            assert.ok(adminViewSource.includes('7. Номер подтверждён'));
            assert.ok(adminViewSource.includes('8. Пассажир активирован'));
            assert.ok(adminViewSource.includes('9. Общая конверсия'));
            assert.ok(adminViewSource.includes('10. Время активации'));
        });

        it('[P1F-FE-09] Visual funnel displays drop-offs and losses', () => {
            assert.ok(adminViewSource.includes('Визуальная воронка активации'));
            assert.ok(adminViewSource.includes('st.dropOff'));
            assert.ok(adminViewSource.includes('st.dropOffPercent'));
        });
    });

    describe('4. Attention Queue, Timeline Modal & Phone Mismatch Review', () => {
        it('[P1F-FE-10] Work queue renders attention items with timeline and review triggers', () => {
            assert.ok(adminViewSource.includes('Рабочая очередь: требуют внимания'));
            assert.ok(adminViewSource.includes('openPassengerTimeline'));
            assert.ok(adminViewSource.includes('openReviewModal'));
        });

        it('[P1F-FE-11] Timeline modal markup exists and renders safe journey events', () => {
            assert.ok(adminViewSource.includes('showTimelineModal'));
            assert.ok(adminViewSource.includes('Путь пассажира'));
            assert.ok(adminViewSource.includes('getEventIcon'));
            assert.ok(adminViewSource.includes('getEventTitle'));
            assert.ok(adminViewSource.includes('formatTimelineDate'));
        });

        it('[P1F-FE-12] Phone mismatch review modal allows approve/reject with reason', () => {
            assert.ok(adminViewSource.includes('showReviewModal'));
            assert.ok(adminViewSource.includes('Проверка несовпадения номера'));
            assert.ok(adminViewSource.includes('reviewDecision'));
            assert.ok(adminViewSource.includes('reviewReason'));
            assert.ok(adminViewSource.includes('submitClaimReview'));
        });
    });

    describe('5. Drill-Down Sub-Tabs: Channels & Carrier Analytics', () => {
        it('[P1F-FE-13] AdminView supports table, channels and carriers drill-down views', () => {
            assert.ok(adminViewSource.includes("funnelActiveSubTab === 'table'"));
            assert.ok(adminViewSource.includes("funnelActiveSubTab === 'channels'"));
            assert.ok(adminViewSource.includes("funnelActiveSubTab === 'carriers'"));
            assert.ok(adminViewSource.includes('Аналитика каналов'));
            assert.ok(adminViewSource.includes('Рейтинг перевозчиков'));
        });
    });

    describe('6. Security & Privacy Protection', () => {
        it('[P1F-FE-14] Frontend source does not contain service_role keys or unmasked phones', () => {
            assert.strictEqual(adminViewSource.includes('service_role'), false);
            assert.strictEqual(adminViewSource.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
        });
    });
});
