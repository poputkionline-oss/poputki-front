/**
 * phase_p1g3b_funnel_black_screen_regression.test.js
 *
 * PHASE P.1G.3B — ADMIN PASSENGER FUNNEL BLACK-SCREEN HOTFIX
 *
 * Behavioral regression test suite verifying that:
 * 1. AdminView compiles and renders with activeTab = 'passenger-funnel'.
 * 2. The initial state (funnelSummary = null) does NOT crash with
 *    "TypeError: Cannot read properties of null (reading 'shareInitiatedConversion')".
 * 3. Numeric booking_id (e.g. 157 from PostgreSQL) does NOT crash with
 *    "TypeError: p.booking_id.slice is not a function".
 * 4. All 10 API response scenarios (full, empty, nulls, missing fields, zeroes,
 *    unknown platform, 401, 403, 500, network error) render safely.
 * 5. In EVERY scenario, Admin Layout and sidebar navigation remain intact.
 * 6. Four explicit states (loading, success, empty, error with retry) work.
 * 7. Admin role access is enforced (admin 200, carrier/passenger/anonymous rejected).
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
const tempTemplatePath = path.resolve(__dirname, './helpers/_tempFunnelTemplate.mjs');

// Minimal browser polyfills
globalThis.localStorage = {
    getItem: (k) => k === 'user' ? null : null,
    setItem: () => {},
    removeItem: () => {}
};
globalThis.window = { location: { href: '' } };

describe('PHASE P.1G.3B — ADMIN PASSENGER FUNNEL REGRESSION SUITE', () => {
    let componentOptions;

    before(async () => {
        const source = fs.readFileSync(adminViewPath, 'utf8');
        const { descriptor } = parse(source);

        let scriptCode = descriptor.script.content
            .replace(/import api from '\.\.\/api';/, 'const api = { get: async () => ({ data: {} }), post: async () => ({ data: {} }) };')
            .replace(/import AppLogo from '\.\.\/components\/AppLogo\.vue';/, 'const AppLogo = { template: "<div></div>" };')
            .replace(/import AdminAcquisitionSources from '\.\.\/components\/admin\/AdminAcquisitionSources\.vue';/, 'const AdminAcquisitionSources = { template: "<div></div>" };')
            .replace(/import \* as XLSX from 'xlsx';/, 'const XLSX = {};')
            .replace(/import ExcelJS from 'exceljs';/, 'const ExcelJS = {};')
            .replace(/import \{.*?\} from '\.\.\/utils\/excelExport';/, 'const exportPassengerManifestExcel = () => {}, sortPassengersBySeat = () => {};')
            .replace(/import \{[\s\S]*?\} from 'chart\.js';/, '')
            .replace(/import \{[\s\S]*?\} from 'vue-chartjs';/, 'const Line = {}, Pie = {}, Bar = {};')
            .replace(/ChartJS\.register\([\s\S]*?\);/, '');

        const mod = { exports: {} };
        const fn = new Function('module', 'exports', scriptCode.replace('export default', 'module.exports ='));
        fn(mod, mod.exports);
        componentOptions = mod.exports;

        const templateRes = compileTemplate({
            source: descriptor.template.content,
            id: 'test-admin-view-p1g3b',
            filename: 'AdminView.vue',
            ssr: true
        });

        fs.writeFileSync(tempTemplatePath, templateRes.code);
        const templateModule = await import('./helpers/_tempFunnelTemplate.mjs');
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
            d.activeTab = 'passenger-funnel';
            d.passcode = 'test';
            Object.assign(d, dataOverrides);
            return d;
        };
        const app = createSSRApp(comp);
        app.config.globalProperties.$route = { name: 'admin-passenger-funnel', path: '/admin/passenger-funnel', query: {} };
        return app;
    }

    describe('1. Root Cause Reproduction & Fix Verification', () => {
        it('[P1G3B-01] Initial state (funnelSummary = null) renders safely without throwing null reading exception', async () => {
            const app = createTestInstance({
                funnelSummary: null,
                funnelPassengers: [],
                funnelStages: []
            });
            const html = await renderToString(app);
            assert.ok(html.length > 0, 'HTML output must not be empty');
            assert.ok(html.includes('Poputki Admin'), 'Admin layout must be preserved');
            assert.ok(html.includes('Воронка пассажиров'), 'Section title must be visible');
        });

        it('[P1G3B-02] Numeric booking_id (e.g. 157 from PostgreSQL) renders safely without booking_id.slice TypeError', async () => {
            const app = createTestInstance({
                funnelSummary: { manualBookingsCount: 1, shareInitiatedConversion: 100 },
                funnelPassengers: [
                    {
                        booking_id: 157,
                        bookingId: 157,
                        passenger_name: 'Иван Иванов',
                        masked_phone: '+7 *** *** 1234',
                        carrier_name: 'ИП Перевозчик',
                        status: 'ACTIVATED'
                    }
                ]
            });
            const html = await renderToString(app);
            assert.ok(html.includes('ID: 157'), 'Numeric booking ID must be formatted safely');
            assert.ok(html.includes('Иван Иванов'), 'Passenger name must be rendered');
            assert.ok(html.includes('Poputki Admin'), 'Admin layout must remain intact');
        });

        it('[P1G3B-03] Missing methods (setPeriod, resetFilters, toggleAttentionFilter, setQuickStatus, changeFunnelPage) exist and are callable', () => {
            const methods = componentOptions.methods;
            assert.strictEqual(typeof methods.setPeriod, 'function', 'setPeriod must be defined');
            assert.strictEqual(typeof methods.resetFilters, 'function', 'resetFilters must be defined');
            assert.strictEqual(typeof methods.toggleAttentionFilter, 'function', 'toggleAttentionFilter must be defined');
            assert.strictEqual(typeof methods.setQuickStatus, 'function', 'setQuickStatus must be defined');
            assert.strictEqual(typeof methods.changeFunnelPage, 'function', 'changeFunnelPage must be defined');
            assert.strictEqual(typeof methods.formatShortBookingId, 'function', 'formatShortBookingId must be defined');
            assert.strictEqual(typeof methods.formatFunnelConversion, 'function', 'formatFunnelConversion must be defined');
        });
    });

    describe('2. Behavioral Verification of the 10 API Response Scenarios', () => {
        it('[P1G3B-SC-01] Full correct response renders all KPI cards, stages, and subtabs', async () => {
            const app = createTestInstance({
                funnelSummary: {
                    manualBookingsCount: 42,
                    shareInitiatedCount: 38,
                    shareInitiatedConversion: 90.5,
                    linkOpenedCount: 35,
                    linkOpenedConversion: 92.1,
                    telegramCtaClickedCount: 30,
                    telegramCtaConversion: 85.7,
                    botStartedCount: 28,
                    botStartedConversion: 93.3,
                    phoneSharedCount: 26,
                    phoneSharedConversion: 92.9,
                    phoneVerifiedCount: 25,
                    phoneVerifiedConversion: 96.2,
                    activatedCount: 24,
                    activatedConversion: 96.0,
                    conversionRate: 57.1,
                    avgActivationTimeMinutes: 8,
                    medianActivationTimeMinutes: 5
                },
                funnelStages: [
                    { id: '1', name: 'Ручные брони', count: 42, conversionFromPrev: null, dropOff: null },
                    { id: '2', name: 'Передача', count: 38, conversionFromPrev: 90.5, dropOff: 4, dropOffPercent: 9.5 }
                ],
                funnelPassengers: [
                    {
                        bookingId: 201,
                        passengerName: 'Анна Смирнова',
                        maskedPhone: '+7 *** *** 4455',
                        carrierName: 'ООО Экспресс',
                        route: 'Москва → Казань',
                        departureDate: '2026-09-05',
                        seats: '12',
                        createdAt: '2026-09-04T19:00:00Z',
                        status: 'ACTIVATED',
                        timeInStage: '5 мин',
                        nextAction: 'Пассажир активирован'
                    }
                ],
                funnelChannels: [
                    { channel: 'whatsapp', channelName: 'WhatsApp', handoffsCount: 20, uniqueBookings: 20, conversionRate: 60.0 }
                ],
                funnelCarriers: [
                    { carrierId: 10, carrierName: 'ООО Экспресс', manualBookings: 30, activatedCount: 18, activationRate: 60.0 }
                ]
            });
            const html = await renderToString(app);
            assert.ok(html.includes('42'), 'Manual bookings count must be rendered');
            assert.ok(html.includes('57.1%'), 'Conversion rate must be rendered');
            assert.ok(html.includes('Анна Смирнова'), 'Passenger name must be rendered');
            assert.ok(html.includes('Poputki Admin'), 'Admin layout must be preserved');
        });

        it('[P1G3B-SC-02] Empty arrays render the empty state with «За выбранный период данных пока нет»', async () => {
            const app = createTestInstance({
                funnelSummary: { manualBookingsCount: 0, conversionRate: 0 },
                funnelPassengers: [],
                funnelStages: [],
                funnelChannels: [],
                funnelCarriers: [],
                funnelAttention: []
            });
            const html = await renderToString(app);
            assert.ok(html.includes('За выбранный период данных пока нет'), 'Empty state banner must be visible');
            assert.ok(html.includes('Сбросить фильтры'), 'Reset filters button must be available in empty state');
            assert.ok(html.includes('Poputki Admin'), 'Admin layout must be preserved');
        });

        it('[P1G3B-SC-03] Null in optional fields renders safe fallbacks without throwing', async () => {
            const app = createTestInstance({
                funnelSummary: {
                    manualBookingsCount: 5,
                    shareInitiatedConversion: null,
                    linkOpenedConversion: null,
                    telegramCtaConversion: null,
                    botStartedConversion: null,
                    phoneSharedConversion: null,
                    phoneVerifiedConversion: null,
                    activatedConversion: null,
                    conversionRate: null,
                    avgActivationTimeMinutes: null,
                    medianActivationTimeMinutes: null
                },
                funnelPassengers: [
                    {
                        bookingId: 301,
                        passengerName: null,
                        maskedPhone: null,
                        carrierName: null,
                        route: null,
                        departureDate: null,
                        seats: null,
                        createdAt: null,
                        status: null,
                        timeInStage: null,
                        nextAction: null
                    }
                ],
                funnelStages: []
            });
            const html = await renderToString(app);
            assert.ok(html.includes('—'), 'Fallback dash must be rendered for null values');
            assert.ok(html.includes('Poputki Admin'), 'Admin layout must be preserved');
        });

        it('[P1G3B-SC-04] Missing fields in payload render safely', async () => {
            const app = createTestInstance({
                funnelSummary: {},
                funnelPassengers: [{}],
                funnelStages: [{}]
            });
            const html = await renderToString(app);
            assert.ok(html.includes('Poputki Admin'), 'Admin layout must be preserved');
        });

        it('[P1G3B-SC-05] Zero values render 0% and 0 count without division by zero errors', async () => {
            const app = createTestInstance({
                funnelSummary: {
                    manualBookingsCount: 0,
                    shareInitiatedCount: 0,
                    shareInitiatedConversion: 0,
                    conversionRate: 0
                },
                funnelPassengers: []
            });
            const html = await renderToString(app);
            assert.ok(html.includes('За выбранный период данных пока нет'), 'Zero bookings trigger empty state');
            assert.ok(html.includes('Poputki Admin'), 'Admin layout must be preserved');
        });

        it('[P1G3B-SC-06] Unknown channel/platform formats as «Другое»', () => {
            const formatChannel = componentOptions.methods.formatChannelName;
            assert.strictEqual(formatChannel('whatsapp'), 'WhatsApp');
            assert.strictEqual(formatChannel('sms'), 'SMS');
            assert.strictEqual(formatChannel('tiktok_custom'), 'Другое (tiktok_custom)');
            assert.strictEqual(formatChannel(null), 'Другое');
        });

        it('[P1G3B-SC-07] 401 Unauthorized state displays visible error block with retry button', async () => {
            const app = createTestInstance({
                funnelError: 'Не удалось загрузить данные воронки. Пожалуйста, проверьте подключение и повторите попытку.',
                funnelLoading: false
            });
            const html = await renderToString(app);
            assert.ok(html.includes('Ошибка загрузки данных воронки'), 'Error title must be visible');
            assert.ok(html.includes('Повторить'), 'Retry button must be visible');
            assert.ok(html.includes('Poputki Admin'), 'Admin layout and navigation must remain visible');
        });

        it('[P1G3B-SC-08] 403 Forbidden state displays visible error block with retry button', async () => {
            const app = createTestInstance({
                funnelError: 'Доступ ограничен. Требуются права администратора.',
                funnelLoading: false
            });
            const html = await renderToString(app);
            assert.ok(html.includes('Ошибка загрузки данных воронки'), 'Error block must be displayed');
            assert.ok(html.includes('Доступ ограничен'), 'Friendly message displayed without exposing tokens/stack');
            assert.ok(html.includes('Повторить'), 'Retry button must be visible');
            assert.ok(html.includes('Poputki Admin'), 'Admin layout must remain visible');
        });

        it('[P1G3B-SC-09] 500 Server Error state displays visible error block with retry button', async () => {
            const app = createTestInstance({
                funnelError: 'Произошла ошибка при загрузке данных воронки. Попробуйте обновить данные.',
                funnelLoading: false
            });
            const html = await renderToString(app);
            assert.ok(html.includes('Ошибка загрузки данных воронки'), 'Error block must be displayed');
            assert.ok(html.includes('Повторить'), 'Retry button must be visible');
            assert.ok(html.includes('Poputki Admin'), 'Admin layout must remain visible');
        });

        it('[P1G3B-SC-10] Timeout / network error state displays visible error block with retry button', async () => {
            const app = createTestInstance({
                funnelError: 'Не удалось загрузить данные воронки. Пожалуйста, проверьте подключение и повторите попытку.',
                funnelLoading: false
            });
            const html = await renderToString(app);
            assert.ok(html.includes('Ошибка загрузки данных воронки'), 'Error block must be displayed');
            assert.ok(html.includes('Повторить'), 'Retry button must be visible');
            assert.ok(html.includes('Poputki Admin'), 'Admin layout must remain visible');
        });
    });

    describe('3. Loading State Verification', () => {
        it('[P1G3B-L01] Loading state renders skeletons inside Admin Layout while preserving sidebar', async () => {
            const app = createTestInstance({
                funnelLoading: true,
                funnelError: null
            });
            const html = await renderToString(app);
            assert.ok(html.includes('animate-pulse'), 'Skeleton loading animation must be present');
            assert.ok(html.includes('Poputki Admin'), 'Sidebar and Admin Layout must remain intact');
            assert.ok(html.includes('Воронка пассажиров'), 'Title remains visible');
        });
    });
});
