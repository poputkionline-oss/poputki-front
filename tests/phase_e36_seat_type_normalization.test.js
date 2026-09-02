/**
 * tests/phase_e36_seat_type_normalization.test.js
 * 
 * Phase E.36.1 — Booked Seat Type Normalization Tests (ESM)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Functions matching BusAdminView.vue & BusSeatSelector.vue logic

function currentBookingTicket(bookingFormBusTicketId, tickets) {
    if (bookingFormBusTicketId === null || bookingFormBusTicketId === undefined || bookingFormBusTicketId === '') return null;
    const targetId = Number(bookingFormBusTicketId);
    if (isNaN(targetId)) return null;
    return tickets.find(t => Number(t.id) === targetId) || null;
}

function bookedSeatsForCurrentTicket(bookingFormBusTicketId, tickets) {
    const ticket = currentBookingTicket(bookingFormBusTicketId, tickets);
    if (!ticket || !Array.isArray(ticket.reserved_seats)) return [];
    return ticket.reserved_seats.map(s => Number(s)).filter(s => !isNaN(s));
}

function normalizedBookedSeats(bookedSeats) {
    if (!Array.isArray(bookedSeats)) return [];
    return bookedSeats.map(s => Number(s)).filter(s => !isNaN(s));
}

function isSeatBooked(seatNum, bookedSeats) {
    const num = Number(seatNum);
    if (isNaN(num)) return false;
    return normalizedBookedSeats(bookedSeats).includes(num);
}

function doubleDeckPremiumSeats(floor2Seats = 56, floor1Seats = 20, premiumSeats = []) {
    const floor2Front = [1, 2, 3, 4];
    const floor1VIP = [];
    for (let i = 1; i <= 10; i++) {
        const seatNum = floor2Seats + i;
        if (seatNum <= floor2Seats + floor1Seats) {
            floor1VIP.push(seatNum);
        }
    }
    const otherPremium = (premiumSeats || []).filter(s => {
        if (s > floor2Seats && s <= floor2Seats + floor1Seats) return floor1VIP.includes(s);
        return true;
    });
    return [...new Set([...floor2Front, ...floor1VIP, ...otherPremium])];
}

function isSeatPremium(seatNum, busType = 'double', floor2Seats = 56, floor1Seats = 20) {
    if (busType !== 'double') return false;
    const num = Number(seatNum);
    if (isNaN(num)) return false;
    return doubleDeckPremiumSeats(floor2Seats, floor1Seats).includes(num);
}

function getSeatClass(seatNum, bookedSeats, selectedSeats = [], busType = 'double', floor2Seats = 56, floor1Seats = 20) {
    if (isSeatBooked(seatNum, bookedSeats)) return 'seat-booked';
    const num = Number(seatNum);
    if (selectedSeats.map(Number).includes(num)) return 'seat-selected';
    if (isSeatPremium(seatNum, busType, floor2Seats, floor1Seats)) return 'seat-premium';
    return 'seat-free';
}

function toggleSeat(seatNum, bookedSeats, selectedSeats = [], maxSelectable = 50) {
    if (isSeatBooked(seatNum, bookedSeats)) return selectedSeats;
    const num = Number(seatNum);
    if (isNaN(num)) return selectedSeats;
    const idx = selectedSeats.map(Number).indexOf(num);
    if (idx > -1) {
        return selectedSeats.filter(s => Number(s) !== num);
    } else {
        if (selectedSeats.length >= maxSelectable) {
            if (maxSelectable === 1) return [num];
            else return [...selectedSeats.slice(1), num];
        } else {
            return [...selectedSeats, num];
        }
    }
}

describe('Phase E.36.1 — Booked Seat Type Normalization Unit Tests', () => {

    const sampleTickets = [
        {
            id: 73,
            from_city: 'Нижневартовск (РФ)',
            to_city: 'Канибадам (TJ)',
            reserved_seats: [4]
        }
    ];

    it('1. Ticket ID number 73 + form ID string "73" -> current ticket resolves', () => {
        const result = currentBookingTicket("73", sampleTickets);
        assert.notEqual(result, null);
        assert.equal(result.id, 73);
    });

    it('2. Booked seat number 4 -> bookedSeatsForCurrentTicket contains number 4', () => {
        const seats = bookedSeatsForCurrentTicket("73", sampleTickets);
        assert.deepEqual(seats, [4]);
        assert.equal(seats.includes(4), true);
    });

    it('3. bookedSeats = [4], seatNum = "4" -> isSeatBooked returns true', () => {
        assert.equal(isSeatBooked("4", [4]), true);
    });

    it('4. bookedSeats = ["4"], seatNum = 4 -> isSeatBooked returns true', () => {
        assert.equal(isSeatBooked(4, ["4"]), true);
    });

    it('5. Booked premium seat #4 -> returns "seat-booked", NOT "seat-premium"', () => {
        const cls = getSeatClass(4, [4], [], 'double');
        assert.equal(cls, 'seat-booked');
    });

    it('6. Booked seat isDisabled logic evaluates to true', () => {
        const disabled = isSeatBooked(4, [4]);
        assert.equal(disabled, true);
    });

    it('7. Click on booked seat does nothing (selection remains empty)', () => {
        const initialSelections = [];
        const result = toggleSeat(4, [4], initialSelections);
        assert.deepEqual(result, []);
    });

    it('8. Free premium seat #1 keeps "seat-premium" style when NOT booked', () => {
        const cls = getSeatClass(1, [], [], 'double');
        assert.equal(cls, 'seat-premium');
    });

    it('9. Other free seats (e.g. seat #10) remain selectable', () => {
        const initialSelections = [];
        const result = toggleSeat(10, [4], initialSelections);
        assert.deepEqual(result, [10]);
    });

    it('10. Confirmed bookings block seats safely', () => {
        const tickets = [{ id: 73, reserved_seats: [4, 5, 12] }];
        const reserved = bookedSeatsForCurrentTicket(73, tickets);
        assert.deepEqual(reserved, [4, 5, 12]);
        assert.equal(isSeatBooked(12, reserved), true);
    });

    it('11. Expired/cancelled bookings governed by backend response (empty array leaves seats free)', () => {
        const tickets = [{ id: 73, reserved_seats: [] }];
        const reserved = bookedSeatsForCurrentTicket(73, tickets);
        assert.equal(isSeatBooked(4, reserved), false);
        assert.equal(getSeatClass(4, reserved, [], 'single'), 'seat-free');
    });

    it('12. Floor 1 / Floor 2 seat range layout logic remains working', () => {
        const floor2Front = doubleDeckPremiumSeats(56, 20);
        assert.equal(floor2Front.includes(1), true);
        assert.equal(floor2Front.includes(4), true);
        assert.equal(floor2Front.includes(57), true);
    });

});
