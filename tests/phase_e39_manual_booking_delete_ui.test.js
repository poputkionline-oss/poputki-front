/**
 * tests/phase_e39_manual_booking_delete_ui.test.js
 * 
 * Phase E.39 — Frontend Manual Booking Delete & Seat Map Refresh Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('PHASE E.39 — FRONTEND MANUAL BOOKING DELETE & SEAT MAP REFRESH', () => {

    const busAdminPath = path.resolve('src/views/BusAdminView.vue');
    const busAdminSource = fs.readFileSync(busAdminPath, 'utf8');

    it('1. deleteBooking refetches BOTH fetchBookings() and fetchTickets() with Promise.all', () => {
        assert.ok(
            busAdminSource.includes('Promise.all([this.fetchBookings(), this.fetchTickets()])'),
            'deleteBooking must refetch both bookings and tickets in Promise.all'
        );
    });

    it('2. deleteBooking optimistically removes booking from this.bookings immediately', () => {
        assert.ok(
            busAdminSource.includes('this.bookings = this.bookings.filter(b => b.id !== id)'),
            'Must update local bookings array immediately for instant UI reactivity'
        );
    });

    it('3. bookedSeatsForCurrentTicket derives active seats directly from this.bookings when available', () => {
        assert.ok(
            busAdminSource.includes('bookedSeatsForCurrentTicket() {'),
            'Must have bookedSeatsForCurrentTicket computed property'
        );
        assert.ok(
            busAdminSource.includes('Array.isArray(this.bookings) && this.bookings.length > 0'),
            'Must check this.bookings for active bookings first'
        );
        assert.ok(
            busAdminSource.includes("b.status !== 'cancelled'"),
            'Must exclude cancelled bookings'
        );
    });

    it('4. seatGendersForCurrentTicket derives genders strictly from remaining active bookings in this.bookings', () => {
        assert.ok(
            busAdminSource.includes('seatGendersForCurrentTicket() {'),
            'Must have seatGendersForCurrentTicket computed property'
        );
        assert.ok(
            busAdminSource.includes('Array.isArray(this.bookings) && this.bookings.length > 0'),
            'Must derive genders from active bookings'
        );
    });

    it('5. Simulation: deleting booking #445 immediately releases seat 4 and its gender style', () => {
        // Create component simulated state
        const state = {
            currentBookingTicket: { id: 73, reserved_seats: [4, 5] },
            bookings: [
                { id: 445, bus_ticket_id: 73, seat_numbers: [4], status: 'confirmed', passengers_data: [{ gender: 'female' }] },
                { id: 446, bus_ticket_id: 73, seat_numbers: [5], status: 'confirmed', passengers_data: [{ gender: 'male' }] }
            ]
        };

        function getBookedSeats(s) {
            if (Array.isArray(s.bookings) && s.bookings.length > 0) {
                const activeSeats = new Set();
                s.bookings
                    .filter(b => Number(b.bus_ticket_id) === Number(s.currentBookingTicket.id) && b.status !== 'cancelled')
                    .forEach(b => {
                        const seats = Array.isArray(b.seat_numbers) ? b.seat_numbers : JSON.parse(b.seat_numbers || '[]');
                        seats.forEach(num => activeSeats.add(Number(num)));
                    });
                return Array.from(activeSeats);
            }
            return s.currentBookingTicket.reserved_seats || [];
        }

        function getSeatGenders(s) {
            const result = {};
            if (Array.isArray(s.bookings) && s.bookings.length > 0) {
                s.bookings
                    .filter(b => Number(b.bus_ticket_id) === Number(s.currentBookingTicket.id) && b.status !== 'cancelled')
                    .forEach(b => {
                        const seats = Array.isArray(b.seat_numbers) ? b.seat_numbers : JSON.parse(b.seat_numbers || '[]');
                        const pData = Array.isArray(b.passengers_data) ? b.passengers_data : JSON.parse(b.passengers_data || '[]');
                        seats.forEach((num, idx) => {
                            const g = pData[idx]?.gender;
                            if (g === 'male' || g === 'female') result[Number(num)] = g;
                        });
                    });
            }
            return result;
        }

        // Before delete
        assert.deepStrictEqual(getBookedSeats(state).sort(), [4, 5]);
        assert.strictEqual(getSeatGenders(state)[4], 'female');
        assert.strictEqual(getSeatGenders(state)[5], 'male');

        // Execute delete of #445
        state.bookings = state.bookings.filter(b => b.id !== 445);

        // Immediately after delete (WITHOUT F5)
        const afterSeats = getBookedSeats(state);
        const afterGenders = getSeatGenders(state);

        assert.deepStrictEqual(afterSeats, [5], 'Seat 4 must be freed immediately');
        assert.strictEqual(afterSeats.includes(4), false);
        assert.strictEqual(afterGenders[4], undefined, 'Seat 4 female style must be cleared');
        assert.strictEqual(afterGenders[5], 'male', 'Seat 5 male style must remain');
    });

});
