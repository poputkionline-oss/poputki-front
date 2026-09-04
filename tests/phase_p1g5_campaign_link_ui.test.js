/**
 * tests/phase_p1g5_campaign_link_ui.test.js
 *
 * Phase P.1G.5: Frontend Unit & Integration Tests for Campaign, Tracked Link & QR Code Management
 */

'use strict';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import jsQR from 'jsqr';
import { getQrSvg, copyToClipboard } from '../src/utils/qrExport.js';
import { generateQRCodeSVG, getQRCodeMatrix } from '../src/utils/qrCode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase P.1G.5 Frontend: Campaign, Tracked Link & QR UI', () => {
    const componentPath = path.resolve(__dirname, '../src/components/admin/AdminAcquisitionSources.vue');
    const componentSrc = fs.readFileSync(componentPath, 'utf8');

    describe('Component Structure & Elements', () => {
        it('includes the "+ Создать кампанию" action button in campaigns subtab', () => {
            assert.ok(
                componentSrc.includes('+ Создать кампанию'),
                'Must contain "+ Создать кампанию" button text'
            );
            assert.ok(
                componentSrc.includes('openCampaignWizard'),
                'Must have openCampaignWizard handler'
            );
        });

        it('includes the 5-step wizard modal in template', () => {
            assert.ok(componentSrc.includes('showCampaignWizard'), 'Must have showCampaignWizard conditional');
            assert.ok(componentSrc.includes('wizardStep === 1'), 'Must have step 1 for Campaign');
            assert.ok(componentSrc.includes('wizardStep === 2'), 'Must have step 2 for Content');
            assert.ok(componentSrc.includes('wizardStep === 3'), 'Must have step 3 for Link');
            assert.ok(componentSrc.includes('wizardStep === 4'), 'Must have step 4 for QR/Token');
            assert.ok(componentSrc.includes('wizardStep === 5'), 'Must have step 5 for Finished');
        });

        it('contains single-exposure warning in step 4', () => {
            assert.ok(
                componentSrc.includes('Внимание: Сохраните ссылку сейчас') || componentSrc.includes('отображается только один раз'),
                'Must display single-exposure token security warning'
            );
        });

        it('contains QR export buttons (SVG, PNG, Print, Copy)', () => {
            assert.ok(componentSrc.includes('Скачать SVG'), 'Must have SVG download button');
            assert.ok(componentSrc.includes('Скачать PNG'), 'Must have PNG download button');
            assert.ok(componentSrc.includes('Печать'), 'Must have Print button');
            assert.ok(componentSrc.includes('Копировать ссылку') || componentSrc.includes('Копировать'), 'Must have Copy button');
        });

        it('contains empty state text for campaigns', () => {
            assert.ok(
                componentSrc.includes('Кампании пока не созданы. Создайте первую кампанию'),
                'Must display exact empty state guidance text'
            );
        });

        it('contains partner dictionary management (+ Добавить партнёра)', () => {
            assert.ok(componentSrc.includes('+ Добавить партнёра'), 'Must have Add Partner button');
            assert.ok(componentSrc.includes('showPartnerModal'), 'Must have partner modal');
            assert.ok(componentSrc.includes('submitPartner'), 'Must have submitPartner method');
        });
    });

    describe('QR Code Generation & Export Logic', () => {
        it('generates crisp SVG QR code with public tracked link', () => {
            const testUrl = 'https://www.poputki.online/l/AbC123xYz999';
            const svg = getQrSvg(testUrl, 200);

            assert.ok(svg.startsWith('<svg'), 'Output must be an SVG element');
            assert.ok(svg.includes('viewBox="0 0 200 200"'), 'Must have correct viewBox');
            assert.ok(svg.includes('<path d="'), 'Must have QR module path data');
            assert.ok(!svg.includes('undefined'), 'Must not contain undefined strings');
            assert.ok(!svg.includes('NaN'), 'Must not contain NaN');
        });

        it('does not leak PII, tokens or external URLs into QR code SVG generation', () => {
            const testUrl = 'https://www.poputki.online/l/safeToken12345';
            const svg = generateQRCodeSVG(testUrl, 160);

            // Verify no external tracking endpoints embedded in the SVG markup
            assert.ok(!svg.includes('http://api.'), 'No insecure external API calls');
            assert.ok(!svg.includes('api.qrserver.com'), 'No third party QR services');
            assert.ok(!svg.includes('chart.googleapis.com'), 'No google chart API calls');
        });

        it('decodes generated QR code using jsQR and verifies exact URL and tracked route', () => {
            const expectedUrl = 'https://www.poputki.online/l/AbC123xYz999';
            const matrixObj = getQRCodeMatrix(expectedUrl);
            assert.ok(matrixObj, 'Matrix must be generated');

            const { moduleCount, modules } = matrixObj;
            const quietZone = 4;
            const scale = 4;
            const totalModules = moduleCount + quietZone * 2;
            const width = totalModules * scale;
            const height = totalModules * scale;
            const data = new Uint8ClampedArray(width * height * 4);

            // Fill with white
            data.fill(255);

            // Draw modules
            for (let r = 0; r < moduleCount; r++) {
                for (let c = 0; c < moduleCount; c++) {
                    if (modules[r][c]) {
                        const startX = (c + quietZone) * scale;
                        const startY = (r + quietZone) * scale;
                        for (let y = 0; y < scale; y++) {
                            for (let x = 0; x < scale; x++) {
                                const idx = ((startY + y) * width + (startX + x)) * 4;
                                data[idx] = 0;     // R
                                data[idx + 1] = 0; // G
                                data[idx + 2] = 0; // B
                                data[idx + 3] = 255; // A
                            }
                        }
                    }
                }
            }

            const code = jsQR(data, width, height);
            assert.ok(code, 'jsQR must successfully decode the generated QR code');
            assert.strictEqual(code.data, expectedUrl, 'Decoded text must exactly match the public tracked link URL');
        });
    });

    describe('Carrier Cabinet Isolation (Admin-Only Gatekeeper)', () => {
        it('ensures BusAdminView (carrier cabinet) does NOT import or render AdminAcquisitionSources', () => {
            const carrierViewPath = path.resolve(__dirname, '../src/views/BusAdminView.vue');
            const carrierViewSrc = fs.readFileSync(carrierViewPath, 'utf8');

            assert.ok(
                !carrierViewSrc.includes('AdminAcquisitionSources'),
                'BusAdminView must NOT import AdminAcquisitionSources'
            );
            assert.ok(
                !carrierViewSrc.includes('admin/acquisition'),
                'BusAdminView must NOT call /admin/acquisition endpoints'
            );
        });
    });
});
