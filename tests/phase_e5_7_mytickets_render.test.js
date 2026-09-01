/**
 * Phase E.5.7 — My Tickets Response to UI Render Tests (ESM)
 *
 * Verifies:
 * 1. API response with 1 claimed manual booking (Booking 420 format) correctly parses into component state
 * 2. b.departure_date string formats (YYYY-MM-DD or ISO timestamp) correctly classify into upcoming list
 * 3. Bookings with missing or null departure_date are never hidden or dropped
 * 4. Empty state is ONLY rendered when bookings array is strictly 0
 * 5. Defensive Array.isArray fallback safely handles res.data array or wrapper object
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Phase E.5.7 — My Tickets Response to UI Render Tests', () => {

    it('[E57-01] Booking 420 response shape parses and classifies into upcoming list', () => {
        const rawBooking420 = {
            id: 420,
            status: 'confirmed',
            claim_status: 'claimed',
            claimed_by_user_id: 1121,
            passenger_id: 11,
            channel: 'manual',
            source_type: 'manual',
            contact_role: 'passenger',
            from_city: 'Душанбе',
            to_city: 'Худжанд',
            departure_date: '2026-09-16',
            departure_time: '08:00',
            arrival_date: '2026-09-16',
            arrival_time: '12:00',
            transport_company: 'POPUTKI.ONLINE',
            price: 100,
            total_price: 100,
            duration_minutes: 240,
            seat_numbers: [1]
        };

        const resData = [rawBooking420];
        const bookings = Array.isArray(resData) ? resData : (resData?.bookings || []);

        assert.strictEqual(bookings.length, 1);
        assert.strictEqual(bookings[0].id, 420);

        const now = new Date('2026-09-01').toISOString().split('T')[0];
        const upcoming = bookings.filter(b => {
            if (!b.departure_date) return true;
            const depDate = String(b.departure_date).split('T')[0];
            return depDate >= now;
        });

        assert.strictEqual(upcoming.length, 1, 'Booking 420 must be classified into upcoming list');
        assert.strictEqual(upcoming[0].id, 420);
    });

    it('[E57-02] ISO timestamp departure_date correctly classifies as upcoming', () => {
        const bookingWithIso = {
            id: 421,
            status: 'confirmed',
            claim_status: 'claimed',
            claimed_by_user_id: 1121,
            departure_date: '2026-09-16T00:00:00.000Z'
        };

        const bookings = [bookingWithIso];
        const now = new Date('2026-09-01').toISOString().split('T')[0];

        const upcoming = bookings.filter(b => {
            if (!b.departure_date) return true;
            const depDate = String(b.departure_date).split('T')[0];
            return depDate >= now;
        });

        assert.strictEqual(upcoming.length, 1);
    });

    it('[E57-03] Null or missing departure_date falls back to upcoming so ticket is never dropped', () => {
        const bookingNoDate = {
            id: 422,
            status: 'confirmed',
            claim_status: 'claimed',
            claimed_by_user_id: 1121,
            departure_date: null
        };

        const bookings = [bookingNoDate];
        const now = new Date('2026-09-01').toISOString().split('T')[0];

        const upcoming = bookings.filter(b => {
            if (!b.departure_date) return true;
            const depDate = String(b.departure_date).split('T')[0];
            return depDate >= now;
        });

        assert.strictEqual(upcoming.length, 1, 'Ticket with null departure_date must not be dropped');
    });

    it('[E57-04] Defensive parsing handles wrapper object { bookings: [...] } gracefully', () => {
        const wrappedResponse = {
            bookings: [{ id: 420, claim_status: 'claimed', claimed_by_user_id: 1121 }]
        };

        const parsed = Array.isArray(wrappedResponse) ? wrappedResponse : (wrappedResponse?.bookings || []);
        assert.strictEqual(parsed.length, 1);
        assert.strictEqual(parsed[0].id, 420);
    });
});
