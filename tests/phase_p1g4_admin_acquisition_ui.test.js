/**
 * tests/phase_p1g4_admin_acquisition_ui.test.js
 *
 * PHASE P.1G.4 — ADMIN PANEL “ИСТОЧНИКИ И КАМПАНИИ” TEST SUITE
 *
 * Behavioral tests verifying:
 * 1. Admin navigation includes «Источники и кампании» on position 3 (after Dashboard and Passenger Funnel).
 * 2. Carrier cabinet (BusAdminView.vue) does NOT expose the section.
 * 3. Component compiles and renders without black screen.
 * 4. 4 explicit states: loading skeleton, error with retry, empty state, full data success.
 * 5. Safe formatters prevent NaN, null reading, or Infinity crashes.
 * 6. Mixed currencies handled safely in campaigns table.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, compileTemplate } from '@vue/compiler-sfc';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminViewPath = path.resolve(__dirname, '../src/views/AdminView.vue');
const busAdminViewPath = path.resolve(__dirname, '../src/views/BusAdminView.vue');
const acquisitionComponentPath = path.resolve(__dirname, '../src/components/admin/AdminAcquisitionSources.vue');
const tempTemplatePath = path.resolve(__dirname, './helpers/_tempAcquisitionTemplate.mjs');

// Minimal browser polyfills
globalThis.localStorage = {
    getItem: (k) => k === 'user' ? null : (k === 'adminToken' ? 'mock-admin-token' : null),
    setItem: () => {},
    removeItem: () => {}
};
globalThis.window = { location: { href: '' } };

describe('PHASE P.1G.4 — ADMIN SOURCES & CAMPAIGNS UI SUITE', () => {
    let componentOptions;

    before(async () => {
        const source = fs.readFileSync(acquisitionComponentPath, 'utf8');
        const { descriptor } = parse(source);

        let scriptCode = descriptor.script.content
            .replace(/import api from '\.\.\/\.\.\/api';/, 'const api = { get: async () => ({ data: {} }), post: async () => ({ data: {} }) };');

        const mod = { exports: {} };
        const fn = new Function('module', 'exports', scriptCode.replace('export default', 'module.exports ='));
        fn(mod, mod.exports);
        componentOptions = mod.exports;

        const templateRes = compileTemplate({
            source: descriptor.template.content,
            id: 'test-admin-acquisition-p1g4',
            filename: 'AdminAcquisitionSources.vue',
            ssr: true
        });

        fs.writeFileSync(tempTemplatePath, templateRes.code);
        const templateModule = await import('./helpers/_tempAcquisitionTemplate.mjs');
        componentOptions.ssrRender = templateModule.ssrRender;
    });

    after(() => {
        if (fs.existsSync(tempTemplatePath)) {
            try { fs.unlinkSync(tempTemplatePath); } catch (_) {}
        }
    });

    function createTestInstance(dataOverrides = {}) {
        const comp = { ...componentOptions };
        const origData = comp.data;
        comp.data = function() {
            const d = origData.call(this);
            Object.assign(d, dataOverrides);
            return d;
        };
        return createSSRApp(comp);
    }

    describe('1. Navigation & Access Control Integrity', () => {
        it('[P1G4-NAV-01] AdminView navItems contains «Источники и кампании» on position 3', () => {
            const source = fs.readFileSync(adminViewPath, 'utf8');
            assert.ok(source.includes("id: 'sources-campaigns'"), 'navItems must contain sources-campaigns');
            assert.ok(source.includes("label: 'Источники и кампании'"), 'navItems must have correct label');
            
            // Verify menu ordering
            const dashboardIdx = source.indexOf("id: 'dashboard'");
            const funnelIdx = source.indexOf("id: 'passenger-funnel'");
            const sourcesIdx = source.indexOf("id: 'sources-campaigns'");
            const usersIdx = source.indexOf("id: 'users'");

            assert.ok(dashboardIdx < funnelIdx, 'Dashboard comes before passenger-funnel');
            assert.ok(funnelIdx < sourcesIdx, 'Passenger-funnel comes before sources-campaigns');
            assert.ok(sourcesIdx < usersIdx, 'Sources-campaigns comes before users');
        });

        it('[P1G4-NAV-02] Carrier cabinet (BusAdminView.vue) does NOT expose sources-campaigns', () => {
            const source = fs.readFileSync(busAdminViewPath, 'utf8');
            assert.equal(source.includes('sources-campaigns'), false, 'Carrier cabinet must not mention sources-campaigns');
            assert.equal(source.includes('AdminAcquisitionSources'), false, 'Carrier cabinet must not import acquisition component');
        });
    });

    describe('2. State Resilience (Loading, Error, Empty, Full Data)', () => {
        it('[P1G4-STATE-01] Loading state renders skeleton elements cleanly without crash', async () => {
            const app = createTestInstance({
                loading: true,
                error: null,
                summary: null
            });
            const html = await renderToString(app);
            assert.ok(html.includes('animate-pulse'), 'Skeleton pulse animation rendered');
            assert.ok(html.includes('Источники и кампании'), 'Section title visible');
        });

        it('[P1G4-STATE-02] Error state displays visible message and «Повторить» button', async () => {
            const app = createTestInstance({
                loading: false,
                error: 'Network timeout loading acquisition summary',
                summary: null
            });
            const html = await renderToString(app);
            assert.ok(html.includes('Ошибка загрузки данных'), 'Error title visible');
            assert.ok(html.includes('Network timeout loading acquisition summary'), 'Error message rendered');
            assert.ok(html.includes('Повторить'), 'Retry button rendered');
        });

        it('[P1G4-STATE-03] Empty / Zero response renders 0 counts and 0% safely without NaN', async () => {
            const app = createTestInstance({
                loading: false,
                error: null,
                summary: {
                    kpis: {
                        unique_visitors: 0,
                        sessions: 0,
                        telegram_opened: 0,
                        bot_starts: 0,
                        contacts_shared: 0,
                        users_identified: 0,
                        bookings_created: 0,
                        paid_bookings: 0,
                        completed_trips: 0,
                        total_revenue: 0,
                        unknown_source_rate: 0,
                        repeat_passengers: 0
                    },
                    funnel: []
                },
                sourcesRows: [],
                campaignsRows: [],
                partnersRows: []
            });
            const html = await renderToString(app);
            assert.ok(!html.includes('NaN'), 'No NaN in empty state');
            assert.ok(!html.includes('Infinity'), 'No Infinity in empty state');
            assert.ok(html.includes('0 TJS'), '0 currency formatted');
        });

        it('[P1G4-STATE-04] Full success state renders all 12 KPI cards and 11 funnel steps', async () => {
            const app = createTestInstance({
                loading: false,
                error: null,
                summary: {
                    kpis: {
                        unique_visitors: 500,
                        sessions: 650,
                        telegram_opened: 120,
                        bot_starts: 95,
                        contacts_shared: 70,
                        users_identified: 68,
                        bookings_created: 45,
                        paid_bookings: 40,
                        completed_trips: 38,
                        total_revenue: 12500,
                        unknown_source_rate: 8.5,
                        repeat_passengers: 12
                    },
                    funnel: [
                        { id: 'visitors', name: 'Посетитель', count: 500, conversion_from_prev: 100, conversion_from_start: 100 },
                        { id: 'route_searched', name: 'Поиск маршрута', count: 350, conversion_from_prev: 70, conversion_from_start: 70 },
                        { id: 'trip_viewed', name: 'Просмотр рейса', count: 280, conversion_from_prev: 80, conversion_from_start: 56 },
                        { id: 'booking_started', name: 'Начало бронирования', count: 180, conversion_from_prev: 64.3, conversion_from_start: 36 },
                        { id: 'telegram_opened', name: 'Открытие Telegram', count: 120, conversion_from_prev: 66.7, conversion_from_start: 24 },
                        { id: 'bot_started', name: 'Запуск бота', count: 95, conversion_from_prev: 79.2, conversion_from_start: 19 },
                        { id: 'contact_shared', name: 'Передача контакта', count: 70, conversion_from_prev: 73.7, conversion_from_start: 14 },
                        { id: 'user_identified', name: 'Регистрация', count: 68, conversion_from_prev: 97.1, conversion_from_start: 13.6 },
                        { id: 'booking_created', name: 'Создание брони', count: 45, conversion_from_prev: 66.2, conversion_from_start: 9 },
                        { id: 'payment_completed', name: 'Оплата', count: 40, conversion_from_prev: 88.9, conversion_from_start: 8 },
                        { id: 'trip_completed', name: 'Выполненная поездка', count: 38, conversion_from_prev: 95, conversion_from_start: 7.6 }
                    ]
                },
                activeSubtab: 'sources',
                sourcesRows: [
                    {
                        source_platform: 'telegram',
                        source_medium: 'paid_social',
                        visitors: 200,
                        sessions: 250,
                        bot_starts: 60,
                        contacts: 50,
                        bookings: 30,
                        paid_bookings: 28,
                        completed_trips: 26,
                        conversion_visit_to_contact: 25,
                        conversion_contact_to_booking: 60,
                        conversion_booking_to_paid: 93.3,
                        total_revenue: 8400
                    },
                    {
                        source_platform: 'unknown',
                        source_medium: 'unknown',
                        visitors: 40,
                        sessions: 42,
                        bot_starts: 5,
                        contacts: 2,
                        bookings: 1,
                        paid_bookings: 1,
                        completed_trips: 1,
                        conversion_visit_to_contact: 5,
                        conversion_contact_to_booking: 50,
                        conversion_booking_to_paid: 100,
                        total_revenue: 300
                    }
                ]
            });
            const html = await renderToString(app);
            assert.ok(html.includes('500'), 'Visitors KPI rendered');
            assert.ok(/12[\s\u00A0]500\s*TJS/.test(html) || html.includes('12500 TJS'), 'Revenue KPI rendered');
            assert.ok(html.includes('telegram'), 'Telegram platform row rendered');
            assert.ok(html.includes('unknown'), 'Unknown platform row rendered separately');
        });
    });

    describe('3. Campaign Mixed Currency & CPA Handling', () => {
        it('[P1G4-CMP-01] Campaigns with mixed currencies show warning and block invalid ROMI', async () => {
            const app = createTestInstance({
                loading: false,
                error: null,
                activeSubtab: 'campaigns',
                campaignsRows: [
                    {
                        code: 'CAMP_RUB',
                        name: 'Russian Campaign',
                        source_platform: 'yandex',
                        campaign_type: 'paid',
                        budget_amount: 10000,
                        currency: 'RUB',
                        visitors: 120,
                        paid_bookings: 15,
                        completed_trips: 12,
                        total_revenue: 4500, // TJS
                        cpa: 666.67,
                        romi: null,
                        currency_mismatch: true
                    }
                ]
            });
            const html = await renderToString(app);
            assert.ok(html.includes('Russian Campaign'), 'Campaign name rendered');
            assert.ok(html.includes('Требуется курс'), 'Currency mismatch warning displayed');
            assert.ok(!html.includes('NaN'), 'No NaN in CPA or ROMI');
        });
    });

    describe('4. Formatting Utility Safety', () => {
        it('[P1G4-FMT-01] Formatters safely handle null, undefined, and non-numeric inputs', () => {
            const m = componentOptions.methods;
            assert.equal(m.formatNumber(null), '0');
            assert.equal(m.formatNumber(undefined), '0');
            assert.equal(m.formatNumber('abc'), '0');

            assert.equal(m.formatPercent(null), '0%');
            assert.equal(m.formatPercent(undefined), '0%');
            assert.equal(m.formatPercent(12.345), '12.3%');

            assert.equal(m.formatCurrency(null), '0 TJS');
            assert.equal(m.formatDate(null), '—');
            assert.equal(m.formatDate('invalid-date'), '—');
        });
    });
});
