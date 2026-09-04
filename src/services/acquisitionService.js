/**
 * src/services/acquisitionService.js
 *
 * Phase P.1G.3: Frontend Attribution Client & Funnel Event Dispatcher
 *
 * Handles first-party anonymous visitor identification, session lifecycle,
 * URL parameter resolution, address bar sanitization, and verified event tracking.
 *
 * Invariants:
 * - Anonymous visitor ID generated via crypto.randomUUID()
 * - Namespaced storage key: poputki_acq_visitor_id (localStorage)
 * - Session timeout: 30 minutes of verified inactivity (sessionStorage)
 * - Zero PII (no phone, passport, JWT, or raw tokens in properties)
 * - Zero fingerprinting (no canvas, WebGL, or font fingerprinting)
 * - Analytics failures never break user interface or booking flows
 */

import api from '../api';

const VISITOR_STORAGE_KEY = 'poputki_acq_visitor_id';
const SESSION_STORAGE_KEY = 'poputki_acq_session';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class AcquisitionService {
    constructor() {
        this.visitorId = null;
        this.sessionId = null;
        this.sessionData = null;
        this.initialized = false;
        this.initPromise = null;
    }

    /**
     * Retrieves or generates a first-party UUIDv4 anonymous visitor ID.
     *
     * @returns {string} Valid UUIDv4
     */
    getOrCreateVisitorId() {
        if (this.visitorId && UUID_V4_REGEX.test(this.visitorId)) {
            return this.visitorId;
        }

        try {
            const stored = localStorage.getItem(VISITOR_STORAGE_KEY);
            if (stored && UUID_V4_REGEX.test(stored)) {
                this.visitorId = stored;
                return this.visitorId;
            }
        } catch (e) {
            // LocalStorage might be disabled in private mode
        }

        // Generate fresh cryptographically secure UUIDv4
        let newId;
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            newId = crypto.randomUUID();
        } else {
            // Standard UUIDv4 fallback
            newId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        }

        this.visitorId = newId;
        try {
            localStorage.setItem(VISITOR_STORAGE_KEY, newId);
        } catch (e) { }

        return this.visitorId;
    }

    /**
     * Extracts safe attribution context from current URL query parameters.
     *
     * @returns {{ trackedToken: string|null, referralCode: string|null, utm: Object, hasAttributionParams: boolean }}
     */
    extractUrlAttribution() {
        if (typeof window === 'undefined' || !window.location) {
            return { trackedToken: null, referralCode: null, utm: {}, hasAttributionParams: false };
        }

        try {
            const params = new URLSearchParams(window.location.search);
            const trackedToken = params.get('acq_token') || null;
            const referralCode = params.get('ref') || null;

            const utm = {};
            const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'placement'];
            let hasUtm = false;

            for (const key of utmKeys) {
                const val = params.get(key);
                if (val) {
                    utm[key] = val.slice(0, 128);
                    hasUtm = true;
                }
            }

            const hasAttributionParams = Boolean(trackedToken || referralCode || hasUtm);
            return { trackedToken, referralCode, utm, hasAttributionParams };
        } catch (e) {
            return { trackedToken: null, referralCode: null, utm: {}, hasAttributionParams: false };
        }
    }

    /**
     * Removes temporary tracking parameters from the URL address bar via history.replaceState.
     */
    scrubUrlParameters() {
        if (typeof window === 'undefined' || !window.history || !window.history.replaceState) {
            return;
        }

        try {
            const url = new URL(window.location.href);
            const keysToRemove = ['acq_token', 'ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'placement'];
            let modified = false;

            for (const key of keysToRemove) {
                if (url.searchParams.has(key)) {
                    url.searchParams.delete(key);
                    modified = true;
                }
            }

            if (modified) {
                const cleanUrl = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') + url.hash;
                window.history.replaceState(window.history.state, document.title, cleanUrl);
            }
        } catch (e) { }
    }

    /**
     * Initializes or restores the acquisition session.
     *
     * @returns {Promise<string|null>} Active session ID
     */
    async initSession() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            const visitorId = this.getOrCreateVisitorId();
            const urlAttr = this.extractUrlAttribution();

            // 1. Check existing session in sessionStorage
            try {
                const storedRaw = sessionStorage.getItem(SESSION_STORAGE_KEY);
                if (storedRaw) {
                    const stored = JSON.parse(storedRaw);
                    const isFresh = stored.lastActiveAt && (Date.now() - stored.lastActiveAt <= SESSION_TIMEOUT_MS);

                    // If session is still active and no NEW incoming campaign/referral parameters exist, reuse it
                    if (isFresh && stored.sessionId && !urlAttr.hasAttributionParams) {
                        this.sessionId = stored.sessionId;
                        this.sessionData = stored;
                        stored.lastActiveAt = Date.now();
                        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stored));
                        this.initialized = true;
                        return this.sessionId;
                    }
                }
            } catch (e) { }

            // 2. Request new session from backend
            try {
                const payload = {
                    anonymous_visitor_id: visitorId,
                    tracked_token: urlAttr.trackedToken,
                    referral_code: urlAttr.referralCode,
                    referrer: typeof document !== 'undefined' ? document.referrer : null,
                    utm: urlAttr.utm,
                    landing_path: typeof window !== 'undefined' ? window.location.pathname : '/'
                };

                const res = await api.post('/acquisition/session', payload, {
                    headers: { 'x-visitor-id': visitorId }
                });

                if (res.data?.success && res.data?.data?.session_id) {
                    this.sessionId = res.data.data.session_id;
                    this.sessionData = {
                        sessionId: this.sessionId,
                        lastActiveAt: Date.now(),
                        landingViewedSent: false,
                        sourcePlatform: res.data.data.source_platform
                    };

                    try {
                        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.sessionData));
                    } catch (e) { }

                    // Clean URL tracking query parameters
                    this.scrubUrlParameters();

                    // Emit LANDING_VIEWED once per session
                    await this.trackLandingViewed();

                    this.initialized = true;
                    return this.sessionId;
                }
            } catch (err) {
                console.warn('[Acquisition] Session initialization non-blocking error:', err?.message || err);
            }

            return null;
        })();

        return this.initPromise;
    }

    /**
     * Dispatches an acquisition event to the backend.
     *
     * @param {string} eventName
     * @param {Object} [properties={}] Safe properties with zero PII
     * @returns {Promise<boolean>}
     */
    async trackEvent(eventName, properties = {}) {
        const visitorId = this.getOrCreateVisitorId();
        const sessionId = this.sessionId;

        // Clean properties
        const safeProps = { ...(properties || {}) };
        delete safeProps.phone;
        delete safeProps.passport;
        delete safeProps.token;
        delete safeProps.password;

        try {
            await api.post('/acquisition/events', {
                anonymous_visitor_id: visitorId,
                session_id: sessionId,
                events: [{
                    event_name: eventName,
                    properties: safeProps,
                    occurred_at: new Date().toISOString()
                }]
            }, {
                headers: { 'x-visitor-id': visitorId }
            });
            return true;
        } catch (err) {
            console.warn(`[Acquisition] Event ${eventName} non-blocking error:`, err?.message || err);
            return false;
        }
    }

    /**
     * Emits LANDING_VIEWED once per acquisition session.
     *
     * Phase P.1G.3A contract-parity fix: the backend's client-event property
     * allowlist only keeps 'page_path' for LANDING_VIEWED — the previous
     * 'landing_path' key was silently stripped server-side, so every
     * LANDING_VIEWED event ever sent recorded no path at all.
     */
    async trackLandingViewed() {
        try {
            if (this.sessionData?.landingViewedSent) {
                return;
            }
            if (this.sessionData) {
                this.sessionData.landingViewedSent = true;
                sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.sessionData));
            }
            await this.trackEvent('LANDING_VIEWED', {
                page_path: typeof window !== 'undefined' ? window.location.pathname : '/'
            });
        } catch (e) { }
    }

    /**
     * Emits ROUTE_SEARCHED after a valid route search is executed.
     *
     * Phase P.1G.3A contract-parity fix: the backend's client-event property
     * allowlist expects 'from_city'/'to_city'/'departure_date' for
     * ROUTE_SEARCHED — the previous 'from_city_id'/'to_city_id'/'travel_date'
     * keys were silently stripped server-side (the values themselves are
     * city name strings from $route.query, not numeric ids, despite the old
     * call-site parameter naming), so every ROUTE_SEARCHED event ever sent
     * recorded nothing. Call sites are unchanged; only the wire property
     * names are corrected here.
     */
    async trackRouteSearched({ from_city_id, to_city_id, travel_date }) {
        if (!from_city_id || !to_city_id) return;
        await this.trackEvent('ROUTE_SEARCHED', {
            from_city: String(from_city_id).slice(0, 128),
            to_city: String(to_city_id).slice(0, 128),
            departure_date: travel_date ? String(travel_date).slice(0, 10) : null
        });
    }

    /**
     * Emits TRIP_VIEWED when passenger opens a specific trip/bus ticket page.
     *
     * Phase P.1G.3A: the backend's client-event property allowlist
     * (services/acquisition/eventIngestionService.js EVENT_ALLOWED_PROPERTIES)
     * only keeps 'trip_id' for TRIP_VIEWED — the previous 'bus_ticket_id' key
     * was silently stripped server-side, so every TRIP_VIEWED event ever sent
     * recorded no trip reference at all. Deduplicated per ticket per session
     * (mirrors trackBookingStarted) so a remount of the details view for the
     * same ticket (e.g. browser back/forward) doesn't record a second view.
     */
    async trackTripViewed({ trip_id, bus_ticket_id }) {
        const id = Number(bus_ticket_id || trip_id) || null;
        if (!id) return;

        try {
            if (this.sessionData) {
                const sentFor = this.sessionData.tripViewedSentForTicketIds || [];
                if (sentFor.includes(id)) return;
                this.sessionData.tripViewedSentForTicketIds = [...sentFor, id];
                sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.sessionData));
            }
        } catch (e) { /* storage unavailable — fall through and send anyway */ }

        await this.trackEvent('TRIP_VIEWED', { trip_id: id });
    }

    /**
     * Emits BOOKING_STARTED when passenger proceeds to book a ticket.
     *
     * Deduplicated per bus_ticket_id per session (mirrors trackLandingViewed):
     * the normal flow fires this from BOTH BusTicketDetailsView's "Book"
     * click AND BusBookingView's own mount (the latter also covers direct/
     * refreshed navigation straight into the booking flow) — without this
     * guard, the common click-through path would double-count every real
     * booking start.
     */
    async trackBookingStarted({ bus_ticket_id }) {
        const id = Number(bus_ticket_id) || null;
        if (!id) return;

        try {
            if (this.sessionData) {
                const sentFor = this.sessionData.bookingStartedSentForTicketIds || [];
                if (sentFor.includes(id)) return;
                this.sessionData.bookingStartedSentForTicketIds = [...sentFor, id];
                sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.sessionData));
            }
        } catch (e) { /* storage unavailable — fall through and send anyway */ }

        // Phase P.1G.3A: the backend's client-event property allowlist
        // (services/acquisition/eventIngestionService.js EVENT_ALLOWED_PROPERTIES)
        // only keeps 'trip_id' for BOOKING_STARTED — sending bus_ticket_id
        // here would be silently stripped server-side, losing the reference
        // entirely (a second, deeper bug behind the original Number-arg one).
        await this.trackEvent('BOOKING_STARTED', { trip_id: id });
    }

    /**
     * Creates a Telegram link session (w_<token>) and opens the Telegram bot.
     *
     * Phase P.1G.3A: the backend's client-event property allowlist
     * (services/acquisition/eventIngestionService.js EVENT_ALLOWED_PROPERTIES)
     * has no 'context' key for TELEGRAM_OPENED — it was silently stripped
     * server-side. Renamed to the allowlisted target_channel/handoff_point
     * pair; neither the raw handshake token nor the full deep-link URL (which
     * embeds that token) is ever included, only a static safe label. Guarded
     * against a double-fire from a rapid double-click while the first call is
     * still in flight (this is a click handler, not a per-item view — there
     * is no ticket/trip id to key a session dedup on).
     *
     * @param {Object} [options]
     * @returns {Promise<string|null>} The deep link URL
     */
    async openTelegramBot() {
        if (this._telegramOpenInFlight) return this._telegramOpenInFlight;

        const run = async () => {
            const visitorId = this.getOrCreateVisitorId();
            let sessionId = this.sessionId;

            if (!sessionId) {
                sessionId = await this.initSession();
            }

            try {
                const res = await api.post('/acquisition/telegram-link-session', {
                    anonymous_visitor_id: visitorId,
                    session_id: sessionId
                }, {
                    headers: { 'x-visitor-id': visitorId }
                });

                const deepLink = res.data?.telegram_deep_link;
                if (deepLink && typeof deepLink === 'string') {
                    // Fires only after a real handshake link was obtained, and
                    // right before the actual handoff — never the token/URL itself.
                    await this.trackEvent('TELEGRAM_OPENED', {
                        target_channel: 'telegram_bot',
                        handoff_point: 'web_to_telegram_cta'
                    });

                    window.open(deepLink, '_blank');
                    return deepLink;
                }
            } catch (err) {
                console.warn('[Acquisition] Telegram link session error:', err?.message || err);
                // Safe fallback to direct bot
                window.open('https://t.me/Poputkionline_bot', '_blank');
                return 'https://t.me/Poputkionline_bot';
            }
            return null;
        };

        this._telegramOpenInFlight = run();
        try {
            return await this._telegramOpenInFlight;
        } finally {
            this._telegramOpenInFlight = null;
        }
    }

    /**
     * Emits SHARE_CLICKED when user clicks a share button.
     *
     * Phase P.1G.3A: property names match the backend's client-event
     * allowlist exactly (services/acquisition/eventIngestionService.js
     * EVENT_ALLOWED_PROPERTIES.SHARE_CLICKED = ['share_channel',
     * 'target_content']) — the previous 'channel'/'context' keys were
     * silently stripped server-side on every call, so no SHARE_CLICKED
     * event ever actually recorded which channel was used.
     *
     * @param {Object} params
     * @param {'telegram'|'whatsapp'|'copy'|'native_share'} params.channel
     * @param {string} [params.referral_code] The short, already-public
     *   referral code embedded in the shared link (NOT a user ID — safe to
     *   record; correlates the click with which link was shared). Sent as
     *   target_content, the allowlisted "what was shared" slot.
     */
    async trackShareClicked({ channel, referral_code }) {
        const props = {
            share_channel: String(channel || 'copy').slice(0, 32)
        };
        if (referral_code) {
            props.target_content = String(referral_code).slice(0, 64);
        }
        await this.trackEvent('SHARE_CLICKED', props);
    }

    /**
     * Returns the non-privileged attribution context to attach to booking creation.
     *
     * @returns {{ anonymous_visitor_id: string, session_id: string|null }}
     */
    getAttributionContext() {
        return {
            anonymous_visitor_id: this.getOrCreateVisitorId(),
            session_id: this.sessionId || null
        };
    }
}

export const acquisitionService = new AcquisitionService();
export default acquisitionService;
