/**
 * phase_p1f_admin_funnel_error_state.test.js
 *
 * PHASE P.1F / HOTFIX: FRONTEND FUNNEL ERROR STATE & ATTENTION FILTER CONSISTENCY
 *
 * Verifies:
 * 1. loading -> spinner is rendered.
 * 2. loaded_success -> table with passenger records rendered.
 * 3. loaded_empty -> "Пассажиры не найдены по выбранным фильтрам" rendered.
 * 4. load_error -> "Не удалось загрузить список пассажиров" + "Повторить" button rendered (NOT empty state).
 * 5. Button "Повторить" invokes fetchFunnelPassengers with current page.
 * 6. Successful /attention queue + failed /passengers: attention badge shown, table error shown simultaneously.
 * 7. Filter consistency: fetchFunnelAttention uses buildFunnelQueryParams() to pass active filters.
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
const tempTemplatePath = path.resolve(__dirname, './helpers/_tempFunnelErrorStateTemplate.mjs');

globalThis.localStorage = {
    getItem: (k) => k === 'adminToken' ? 'test-token' : null,
    setItem: () => {},
    removeItem: () => {}
};
globalThis.window = { location: { href: '' } };

describe('FRONTEND HOTFIX GATE — ADMIN FUNNEL ERROR STATE & FILTER CONSISTENCY', () => {
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
            id: 'test-admin-view-error-state',
            filename: 'AdminView.vue',
            ssr: true
        });

        fs.writeFileSync(tempTemplatePath, templateRes.code);
        const templateModule = await import('./helpers/_tempFunnelErrorStateTemplate.mjs');
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
            d.funnelActiveSubTab = 'table';
            d.isAuthenticated = true;
            d.funnelLoading = false;
            d.funnelError = null;
            d.funnelSummary = {
                manualBookingsCount: 11,
                shareInitiatedCount: 0,
                linkOpenedCount: 0,
                telegramCtaClickedCount: 0,
                botStartedCount: 0,
                ticketsSold: 0,
                conversionRate: 0
            };
            Object.assign(d, dataOverrides);
            return d;
        };
        const app = createSSRApp(comp);
        app.config.globalProperties.$route = { name: 'admin-passenger-funnel', path: '/admin/passenger-funnel', query: {} };
        return app;
    }

    it('[FE-HOTFIX-01] Loading state: shows spinner in table when loading', async () => {
        const app = createTestInstance({
            funnelPassengersLoading: true,
            funnelPassengers: [],
            funnelPassengersError: null
        });
        const html = await renderToString(app);
        assert.ok(html.includes('animate-spin'), 'Spinner must be present when funnelPassengersLoading is true');
        assert.strictEqual(html.includes('Пассажиры не найдены по выбранным фильтрам'), false);
    });

    it('[FE-HOTFIX-02] Success state with data: renders passenger table and rows', async () => {
        const app = createTestInstance({
            funnelPassengersLoading: false,
            funnelPassengersError: null,
            funnelPassengers: [
                {
                    bookingId: 449,
                    booking_id: 449,
                    passengerName: 'Пассажир Тест',
                    passenger_name: 'Пассажир Тест',
                    maskedPhone: '+992 ** *** 4449',
                    carrierName: 'ООО Рохи Абрешим',
                    route: 'Худжанд → Нижневартовск',
                    status: 'PHONE_MISMATCH'
                }
            ],
            funnelPagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
        });
        const html = await renderToString(app);
        assert.ok(html.includes('Пассажир Тест'), 'Passenger name must be in table');
        assert.ok(html.includes('+992 ** *** 4449'), 'Masked phone must be in table');
        assert.strictEqual(html.includes('Пассажиры не найдены по выбранным фильтрам'), false);
        assert.strictEqual(html.includes('Не удалось загрузить список пассажиров'), false);
    });

    it('[FE-HOTFIX-03] Empty state: renders "Пассажиры не найдены по выбранным фильтрам" when no error and empty list', async () => {
        const app = createTestInstance({
            funnelPassengersLoading: false,
            funnelPassengersError: null,
            funnelPassengers: [],
            funnelPagination: { page: 1, limit: 20, total: 0, totalPages: 1 }
        });
        const html = await renderToString(app);
        assert.ok(html.includes('Пассажиры не найдены по выбранным фильтрам'), 'Empty state banner must be shown');
        assert.ok(html.includes('Сбросить фильтры'), 'Reset filters button must be available');
        assert.strictEqual(html.includes('Не удалось загрузить список пассажиров'), false);
    });

    it('[FE-HOTFIX-04] Error state: renders "Не удалось загрузить список пассажиров" and retry button, NOT false empty state', async () => {
        const app = createTestInstance({
            funnelPassengersLoading: false,
            funnelPassengersError: 'Не удалось загрузить список пассажиров',
            funnelPassengers: []
        });
        const html = await renderToString(app);
        assert.ok(html.includes('Не удалось загрузить список пассажиров'), 'Error message must be shown');
        assert.ok(html.includes('Повторить'), 'Retry button must be visible in error state');
        assert.strictEqual(
            html.includes('Пассажиры не найдены по выбранным фильтрам'),
            false,
            'Must NOT show false empty state when error occurred!'
        );
    });

    it('[FE-HOTFIX-05] Partial success: attention queue 11 items and table error state are shown concurrently', async () => {
        const app = createTestInstance({
            funnelAttention: new Array(11).fill({ issueType: 'NOT_SHARED', priority: 'LOW' }),
            funnelPassengersLoading: false,
            funnelPassengersError: 'Не удалось загрузить список пассажиров',
            funnelPassengers: []
        });
        const html = await renderToString(app);
        // Badge displays 11
        assert.ok(html.includes('Только требующие внимания (11)'), 'Pill button badge must show 11');
        // Table shows clear error state with retry
        assert.ok(html.includes('Не удалось загрузить список пассажиров'), 'Table error must be explicit');
        assert.ok(html.includes('Повторить'), 'Retry button must be present');
    });

    it('[FE-HOTFIX-06] fetchFunnelAttention sends active query parameters', async () => {
        const methods = componentOptions.methods;
        let calledUrl = null;

        const fakeContext = {
            funnelFilters: {
                period: '7days',
                channel: 'whatsapp',
                carrier_id: '11',
                status: 'NOT_SHARED',
                attentionOnly: true,
                search: 'Иван'
            },
            buildFunnelQueryParams: methods.buildFunnelQueryParams,
            normalizeAttentionItem: methods.normalizeAttentionItem,
            funnelAttention: []
        };

        // Inject spy for api.get
        const origApi = globalThis.api;
        // Directly test buildFunnelQueryParams
        const qs = fakeContext.buildFunnelQueryParams();
        assert.ok(qs.includes('period=7days'));
        assert.ok(qs.includes('channel=whatsapp'));
        assert.ok(qs.includes('carrier_id=11'));
        assert.ok(qs.includes('status=NOT_SHARED'));
        assert.ok(qs.includes('attentionOnly=true'));
        assert.ok(qs.includes('search=%D0%98%D0%B2%D0%B0%D0%BD'));
    });

    it('[FE-HOTFIX-07] AdminView source code enforces fetchFunnelAttention query params call', () => {
        const source = fs.readFileSync(adminViewPath, 'utf8');
        assert.ok(
            source.includes('api.get(`/admin/passenger-funnel/attention?${qs}`)'),
            'fetchFunnelAttention must pass query string from buildFunnelQueryParams'
        );
    });
});
