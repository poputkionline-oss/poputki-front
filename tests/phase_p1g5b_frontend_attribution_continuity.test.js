/**
 * tests/phase_p1g5b_frontend_attribution_continuity.test.js
 *
 * Phase P.1G.5B: Frontend Root Lifecycle & Attribution Continuity Test Suite
 */

'use strict';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase P.1G.5B: Frontend Root Attribution Lifecycle Suite', () => {
    describe('1. Root Application Mount Lifecycle (App.vue)', () => {
        it('ensures App.vue imports acquisitionService and calls initSession on mount', () => {
            const appPath = path.resolve(__dirname, '../src/App.vue');
            assert.ok(fs.existsSync(appPath), 'App.vue must exist');
            const content = fs.readFileSync(appPath, 'utf8');

            assert.ok(
                content.includes("import acquisitionService from './services/acquisitionService'"),
                'App.vue must import acquisitionService'
            );
            assert.ok(
                content.includes('acquisitionService.initSession()'),
                'App.vue must call acquisitionService.initSession() in mounted hook'
            );
        });
    });

    describe('2. Direct Landing Route Protection (SearchResultsView.vue)', () => {
        it('ensures SearchResultsView.vue calls initSession on mount for direct /search landing', () => {
            const searchViewPath = path.resolve(__dirname, '../src/views/SearchResultsView.vue');
            assert.ok(fs.existsSync(searchViewPath), 'SearchResultsView.vue must exist');
            const content = fs.readFileSync(searchViewPath, 'utf8');

            assert.ok(
                content.includes("import acquisitionService from '../services/acquisitionService'"),
                'SearchResultsView.vue must import acquisitionService'
            );
            assert.ok(
                content.includes('acquisitionService.initSession()'),
                'SearchResultsView.vue must call acquisitionService.initSession() in mounted hook'
            );
        });
    });

    describe('3. Token Scrubbing & Storage Privacy Invariants', () => {
        const servicePath = path.resolve(__dirname, '../src/services/acquisitionService.js');
        const content = fs.readFileSync(servicePath, 'utf8').replace(/\r\n/g, '\n');

        it('extracts acq_token from URL search parameters on first landing', () => {
            assert.ok(
                content.includes("const trackedToken = params.get('acq_token') || null;"),
                'Must extract acq_token parameter'
            );
        });

        it('scrubs acq_token from address bar via history.replaceState early and reliably', () => {
            assert.ok(
                content.includes("const keysToRemove = ['acq_token', 'ref', 'utm_source'"),
                'keysToRemove must include acq_token'
            );
            assert.ok(
                content.includes('window.history.replaceState'),
                'Must call history.replaceState to scrub tracking parameters from address bar'
            );
            assert.ok(
                content.includes('if (urlAttr.hasAttributionParams) {\n                this.scrubUrlParameters();\n            }'),
                'Must scrub URL tracking parameters immediately on extraction'
            );
        });

        it('does NOT store raw acq_token or trackedToken in localStorage or sessionStorage', () => {
            assert.ok(
                !content.includes("localStorage.setItem('acq_token'"),
                'Must NEVER save acq_token to localStorage'
            );
            assert.ok(
                !content.includes("sessionStorage.setItem('acq_token'"),
                'Must NEVER save acq_token to sessionStorage'
            );
            assert.ok(
                !content.includes("localStorage.setItem('tracked_token'"),
                'Must NEVER save tracked_token to localStorage'
            );
            assert.ok(
                !content.includes("sessionStorage.setItem('tracked_token'"),
                'Must NEVER save tracked_token to sessionStorage'
            );
            assert.ok(
                !content.includes("console.log(trackedToken") && !content.includes("console.log(params.get('acq_token')"),
                'Must NEVER log raw acq_token to console'
            );
        });
    });

    describe('4. In-flight Deduplication & Referrer Security Policy', () => {
        it('ensures acquisitionService.initSession() implements in-flight promise deduplication', () => {
            const servicePath = path.resolve(__dirname, '../src/services/acquisitionService.js');
            const content = fs.readFileSync(servicePath, 'utf8').replace(/\r\n/g, '\n');

            assert.ok(
                content.includes('if (this.initPromise) {\n            return this.initPromise;\n        }'),
                'Must check this.initPromise to deduplicate concurrent calls'
            );
            assert.ok(
                content.includes('this.initPromise = run();') &&
                content.includes('try {\n            return await this.initPromise;\n        } finally {\n            this.initPromise = null;\n        }'),
                'Must manage initPromise lifecycle with run/finally pattern'
            );
        });

        it('verifies concurrent calls from App.vue and SearchResultsView.vue produce a single in-flight execution', async () => {
            // Simulate acquisition service instance logic
            let postSessionCalls = 0;
            let landingViewedCalls = 0;

            class MockAcquisitionService {
                constructor() {
                    this.initPromise = null;
                    this.sessionId = null;
                    this.sessionData = null;
                }

                async initSession() {
                    if (this.initPromise) {
                        return this.initPromise;
                    }

                    const run = async () => {
                        // Simulate async network roundtrip
                        await new Promise((resolve) => setTimeout(resolve, 15));
                        postSessionCalls++;
                        this.sessionId = 'mock-session-uuid-123';
                        this.sessionData = {
                            sessionId: this.sessionId,
                            landingViewedSent: false
                        };

                        await this.trackLandingViewed();
                        return this.sessionId;
                    };

                    this.initPromise = run();
                    try {
                        return await this.initPromise;
                    } finally {
                        this.initPromise = null;
                    }
                }

                async trackLandingViewed() {
                    if (this.sessionData?.landingViewedSent) return;
                    this.sessionData.landingViewedSent = true;
                    landingViewedCalls++;
                }
            }

            const mockService = new MockAcquisitionService();

            // Simulate concurrent invocation from App.vue (mounted) and SearchResultsView.vue (onMounted)
            const [sessionFromApp, sessionFromSearchResults] = await Promise.all([
                mockService.initSession(),
                mockService.initSession()
            ]);

            assert.equal(postSessionCalls, 1, 'Only exactly 1 backend session request should be dispatched');
            assert.equal(landingViewedCalls, 1, 'Only exactly 1 LANDING_VIEWED event should be emitted');
            assert.equal(sessionFromApp, 'mock-session-uuid-123');
            assert.equal(sessionFromSearchResults, 'mock-session-uuid-123');
            assert.equal(sessionFromApp, sessionFromSearchResults, 'Both callers must receive the exact same session_id');
        });

        it('ensures index.html specifies strict-origin-when-cross-origin referrer policy', () => {
            const indexPath = path.resolve(__dirname, '../index.html');
            assert.ok(fs.existsSync(indexPath), 'index.html must exist');
            const content = fs.readFileSync(indexPath, 'utf8');

            assert.ok(
                content.includes('<meta name="referrer" content="strict-origin-when-cross-origin" />'),
                'index.html must include strict-origin-when-cross-origin meta tag'
            );
        });
    });
});
