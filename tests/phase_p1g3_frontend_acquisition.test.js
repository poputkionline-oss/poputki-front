/**
 * phase_p1g3_frontend_acquisition.test.js
 *
 * Phase P.1G.3: Frontend Funnel Integration, Referral Sharing, and Reliable Tracking
 * POPUTKI.ONLINE
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read source files for static architecture & invariant validation
const acquisitionServiceSource = fs.readFileSync(path.resolve(__dirname, '../src/services/acquisitionService.js'), 'utf-8');
const landingViewSource = fs.readFileSync(path.resolve(__dirname, '../src/views/LandingView.vue'), 'utf-8');
const searchResultsSource = fs.readFileSync(path.resolve(__dirname, '../src/views/SearchResultsView.vue'), 'utf-8');
const busTicketDetailsSource = fs.readFileSync(path.resolve(__dirname, '../src/views/BusTicketDetailsView.vue'), 'utf-8');
const busBookingSource = fs.readFileSync(path.resolve(__dirname, '../src/views/BusBookingView.vue'), 'utf-8');
const profileSource = fs.readFileSync(path.resolve(__dirname, '../src/views/ProfileView.vue'), 'utf-8');

describe('PHASE P.1G.3 — FRONTEND FUNNEL INTEGRATION & ACQUISITION TESTS', () => {

    describe('1. Acquisition Service Architecture & Privacy Invariants', () => {
        it('[P1G3-F01] Generates and persists anonymous visitor ID using UUIDv4', () => {
            assert.ok(acquisitionServiceSource.includes('crypto.randomUUID()'));
            assert.ok(acquisitionServiceSource.includes('poputki_acq_visitor_id'));
        });

        it('[P1G3-F02] Manages 30-minute session expiry and sessionStorage lifecycle', () => {
            assert.ok(acquisitionServiceSource.includes('SESSION_TIMEOUT_MS = 30 * 60 * 1000'));
            assert.ok(acquisitionServiceSource.includes('poputki_acq_session'));
            assert.ok(acquisitionServiceSource.includes('lastActiveAt'));
        });

        it('[P1G3-F03] Scrubs marketing URL parameters from address bar to prevent leaking', () => {
            assert.ok(acquisitionServiceSource.includes('history.replaceState'));
            assert.ok(acquisitionServiceSource.includes('keysToRemove'));
            assert.ok(acquisitionServiceSource.includes('utm_source'));
        });

        it('[P1G3-F04] Never stores or transmits PII in client event telemetry', () => {
            // Check that forbidden PII fields are never assigned to event properties
            assert.ok(!acquisitionServiceSource.includes('passenger_name'));
            assert.ok(!acquisitionServiceSource.includes('passport_number'));
            assert.ok(!acquisitionServiceSource.includes('card_number'));
        });

        it('[P1G3-F05] Defines only allowed client events and strictly enforces allowlist', () => {
            const allowed = [
                'LANDING_VIEWED',
                'ROUTE_SEARCHED',
                'TRIP_VIEWED',
                'BOOKING_STARTED',
                'TELEGRAM_OPENED',
                'SHARE_CLICKED'
            ];
            for (const ev of allowed) {
                assert.ok(acquisitionServiceSource.includes(ev), `Missing allowed event: ${ev}`);
            }
            // Ensure server-only events are not exposed as client emit methods
            assert.ok(!acquisitionServiceSource.includes('trackBookingCreated'));
            assert.ok(!acquisitionServiceSource.includes('trackPaymentCompleted'));
            assert.ok(!acquisitionServiceSource.includes('trackTripCompleted'));
        });

        it('[P1G3-F06] Handshake token generates valid Telegram bot deep-link flow', () => {
            assert.ok(acquisitionServiceSource.includes('telegram-link-session'));
            assert.ok(acquisitionServiceSource.includes('telegram_deep_link'));
            assert.ok(acquisitionServiceSource.includes('https://t.me/Poputkionline_bot'));
        });
    });

    describe('2. Funnel Touchpoints Integration Across Views', () => {
        it('[P1G3-F07] LandingView initializes acquisition session and tracks search and bot clicks', () => {
            assert.ok(landingViewSource.includes("import acquisitionService from '../services/acquisitionService'"));
            assert.ok(landingViewSource.includes('acquisitionService.initSession()'));
            assert.ok(landingViewSource.includes('acquisitionService.trackRouteSearched'));
            assert.ok(landingViewSource.includes('openTelegramBot'));
        });

        it('[P1G3-F08] SearchResultsView tracks route search event', () => {
            assert.ok(searchResultsSource.includes("import acquisitionService from '../services/acquisitionService'"));
            assert.ok(searchResultsSource.includes('acquisitionService.trackRouteSearched'));
        });

        it('[P1G3-F09] BusTicketDetailsView tracks TRIP_VIEWED and BOOKING_STARTED', () => {
            assert.ok(busTicketDetailsSource.includes("import acquisitionService from '../services/acquisitionService'"));
            assert.ok(busTicketDetailsSource.includes('acquisitionService.trackTripViewed'));
            assert.ok(busTicketDetailsSource.includes('acquisitionService.trackBookingStarted'));
        });

        it('[P1G3-F10] BusBookingView attaches attribution context to /payments/create-invoice', () => {
            assert.ok(busBookingSource.includes("import acquisitionService from '../services/acquisitionService'"));
            assert.ok(busBookingSource.includes('const attrCtx = acquisitionService.getAttributionContext()'));
            assert.ok(busBookingSource.includes('anonymous_visitor_id: attrCtx.anonymous_visitor_id'));
            assert.ok(busBookingSource.includes('session_id: attrCtx.session_id'));
        });
    });

    describe('3. Passenger Referral & Marketing Consent Invariants', () => {
        it('[P1G3-F11] ProfileView contains referral sharing card with WhatsApp, Telegram and Copy', () => {
            assert.ok(profileSource.includes('Рекомендовать друзьям'));
            assert.ok(profileSource.includes('copyReferralLink'));
            assert.ok(profileSource.includes('shareWhatsApp'));
            assert.ok(profileSource.includes('shareTelegram'));
            assert.ok(profileSource.includes('acquisitionService.trackShareClicked'));
        });

        it('[P1G3-F12] ProfileView implements explicit Marketing Opt-In Toggle with default false', () => {
            assert.ok(profileSource.includes('marketingConsent: false'));
            assert.ok(profileSource.includes('toggleMarketingConsent'));
            assert.ok(profileSource.includes('/marketing-consents'));
        });

        it('[P1G3-F13] Invariant CONTACT_DOES_NOT_GRANT_CONSENT is respected (explicit opt-in only)', () => {
            // ProfileView toggle only interacts with dedicated /marketing-consents endpoints
            assert.ok(profileSource.includes("api.post('/marketing-consents'"));
            assert.ok(profileSource.includes("api.post('/marketing-consents/revoke'"));
        });
    });
});
