/**
 * tests/phase_p1g5a_tracked_routing_and_links_ui.test.js
 *
 * Phase P.1G.5A: Frontend & Routing Regression Tests for Tracked Links and Campaign Links UX
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase P.1G.5A: Frontend Routing & UX Resilience Suite', () => {
    // -------------------------------------------------------------------------
    // 1. Vercel Proxy Rewrites Priority
    // -------------------------------------------------------------------------
    describe('vercel.json Rewrite Rules', () => {
        it('ensures /l/:token and /r/:code rewrites precede the SPA catch-all rule', () => {
            const vercelPath = path.resolve(__dirname, '../vercel.json');
            assert.ok(fs.existsSync(vercelPath), 'vercel.json must exist');

            const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
            assert.ok(Array.isArray(vercelConfig.rewrites), 'rewrites array must be present');

            const trackedRuleIndex = vercelConfig.rewrites.findIndex(r => r.source === '/l/:token');
            const referralRuleIndex = vercelConfig.rewrites.findIndex(r => r.source === '/r/:code');
            const catchAllRuleIndex = vercelConfig.rewrites.findIndex(r => r.source === '/(.*)');

            assert.ok(trackedRuleIndex !== -1, 'Must have a dedicated /l/:token rewrite rule');
            assert.ok(referralRuleIndex !== -1, 'Must have a dedicated /r/:code rewrite rule');
            assert.ok(catchAllRuleIndex !== -1, 'Must have an SPA catch-all rule');

            assert.ok(
                trackedRuleIndex < catchAllRuleIndex,
                `Tracked link rule (index ${trackedRuleIndex}) must come BEFORE SPA catch-all rule (index ${catchAllRuleIndex})`
            );
            assert.ok(
                referralRuleIndex < catchAllRuleIndex,
                `Referral link rule (index ${referralRuleIndex}) must come BEFORE SPA catch-all rule (index ${catchAllRuleIndex})`
            );

            assert.strictEqual(
                vercelConfig.rewrites[trackedRuleIndex].destination,
                'https://poputki-backend-9dv6.onrender.com/l/:token'
            );
            assert.strictEqual(
                vercelConfig.rewrites[referralRuleIndex].destination,
                'https://poputki-backend-9dv6.onrender.com/r/:code'
            );
        });
    });

    describe('Vue Router Configuration & Loop Prevention', () => {
        it('includes /l/:token route with direct backend delegation and public access', () => {
            const routerPath = path.resolve(__dirname, '../src/router/index.js');
            const content = fs.readFileSync(routerPath, 'utf8');

            assert.ok(content.includes("path: '/l/:token'"), 'Router must register /l/:token');
            assert.ok(content.includes("name: 'tracked-link-redirect'"), 'Route must be named tracked-link-redirect');
            assert.ok(content.includes('window.location.replace'), 'Fail-safe must perform location.replace');
            assert.ok(content.includes("'tracked-link-redirect'"), 'Route name must be included in publicRoutes');
            assert.ok(content.includes("'referral-link-redirect'"), 'Referral route must be included in publicRoutes');
        });

        it('proves absence of same-URL reload loop (never reloads current URL or same domain)', () => {
            const routerPath = path.resolve(__dirname, '../src/router/index.js');
            const content = fs.readFileSync(routerPath, 'utf8');

            // Find the beforeEnter handler for /l/:token
            const routeBlockMatch = content.match(/path:\s*['"]\/l\/:token['"][\s\S]*?beforeEnter\(to\)\s*\{([\s\S]*?)\n\s*\}\s*\},/);
            assert.ok(routeBlockMatch, 'Must find /l/:token route block');
            const beforeEnterBody = routeBlockMatch[1];

            // 1. Must NOT assign window.location.href to itself or relative path
            assert.ok(!beforeEnterBody.includes('window.location.href = window.location.href'), 'Must NOT reload same href');
            assert.ok(!beforeEnterBody.includes("window.location.href = `/l/"), 'Must NOT navigate to same relative /l/ path');
            assert.ok(!beforeEnterBody.includes("window.location.replace(`/l/"), 'Must NOT replace with same relative /l/ path');

            // 2. Must delegate to external backend host
            assert.ok(beforeEnterBody.includes('backendHost'), 'Must resolve backendHost');
            assert.ok(beforeEnterBody.includes('${backendHost}/l/'), 'Target URL must point to backend host');

            // 3. Must have explicit loop guard
            assert.ok(beforeEnterBody.includes('window.location.href !== targetUrl'), 'Must guard against same-URL reload');
        });
    });

    // -------------------------------------------------------------------------
    // 3. AdminAcquisitionSources Component Contract & Error Handling
    // -------------------------------------------------------------------------
    describe('AdminAcquisitionSources UX & Contract Resilience', () => {
        const componentPath = path.resolve(__dirname, '../src/components/admin/AdminAcquisitionSources.vue');
        const content = fs.readFileSync(componentPath, 'utf8');

        it('supports both campaign.id and campaign.campaign_id in openCampaignDetails and loadCampaignLinks', () => {
            assert.ok(
                content.includes('const campaignId = camp?.id || camp?.campaign_id;'),
                'loadCampaignLinks must fallback to camp.campaign_id if camp.id is undefined'
            );
            assert.ok(
                content.includes('const campaignId = c?.id || c?.campaign_id;'),
                'promptToggleCampaignStatus must support c.campaign_id'
            );
            assert.ok(
                content.includes('const campaignId = this.selectedCampaign?.id || this.selectedCampaign?.campaign_id;'),
                'submitNewLink must support selectedCampaign.campaign_id'
            );
        });

        it('defines safe localized error messages for link loading failures', () => {
            assert.ok(
                content.includes('Сессия администратора истекла — войдите снова'),
                'Must display expired admin session message on 401'
            );
            assert.ok(
                content.includes('Кампания не найдена'),
                'Must display campaign not found message on 404'
            );
            assert.ok(
                content.includes('Не удалось загрузить ссылки. Повторите попытку'),
                'Must display safe retry message on general error'
            );
        });

        it('renders retry button inside campaign links error state', () => {
            assert.ok(
                content.includes('v-else-if="campaignLinksError"'),
                'Template must contain conditional block for campaignLinksError'
            );
            assert.ok(
                content.includes('@click="loadCampaignLinks(selectedCampaign)"'),
                'Template must bind Retry button to loadCampaignLinks'
            );
            assert.ok(
                content.includes('Повторить'),
                'Retry button label must be present'
            );
        });

        it('handles link status toggle error with safe message', () => {
            assert.ok(
                content.includes("Ссылка недоступна или отключена"),
                'toggleLinkStatus error must display safe message'
            );
        });
    });
});
