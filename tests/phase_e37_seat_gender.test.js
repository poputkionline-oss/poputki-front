/**
 * tests/phase_e37_seat_gender.test.js
 * 
 * Phase E.37 — Carrier Seat Gender Display Unit Tests (ESM)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// BusSeatSelector helper mocks
function normalizedBookedSeats(bookedSeats) {
    if (!Array.isArray(bookedSeats)) return [];
    return bookedSeats.map(s => Number(s)).filter(s => !isNaN(s));
}

function isSeatBooked(seatNum, bookedSeats) {
    const num = Number(seatNum);
    if (isNaN(num)) return false;
    return normalizedBookedSeats(bookedSeats).includes(num);
}

function getBookedSeatGender(seatNum, bookedSeats, seatGenders = {}) {
    if (!isSeatBooked(seatNum, bookedSeats)) return null;
    const num = Number(seatNum);
    const gender = seatGenders?.[num] || seatGenders?.[String(seatNum)] || null;
    return (gender === 'male' || gender === 'female') ? gender : null;
}

function doubleDeckPremiumSeats(floor2Seats = 56, floor1Seats = 20) {
    const floor2Front = [1, 2, 3, 4];
    const floor1VIP = [];
    for (let i = 1; i <= 10; i++) {
        const seatNum = floor2Seats + i;
        if (seatNum <= floor2Seats + floor1Seats) {
            floor1VIP.push(seatNum);
        }
    }
    return [...new Set([...floor2Front, ...floor1VIP])];
}

function isSeatPremium(seatNum, busType = 'double', floor2Seats = 56, floor1Seats = 20) {
    if (busType !== 'double') return false;
    const num = Number(seatNum);
    if (isNaN(num)) return false;
    return doubleDeckPremiumSeats(floor2Seats, floor1Seats).includes(num);
}

function getSeatClass(seatNum, bookedSeats, seatGenders = {}, selectedSeats = [], busType = 'double') {
    if (isSeatBooked(seatNum, bookedSeats)) {
        const gender = getBookedSeatGender(seatNum, bookedSeats, seatGenders);
        if (gender === 'male') return 'seat-booked seat-male-booked booked-male';
        if (gender === 'female') return 'seat-booked seat-female-booked booked-female';
        return 'seat-booked';
    }
    const num = Number(seatNum);
    if (selectedSeats.map(Number).includes(num)) return 'seat-selected';
    if (isSeatPremium(seatNum, busType)) return 'seat-premium';
    return 'seat-free';
}

function toggleSeat(seatNum, bookedSeats, selectedSeats = []) {
    if (isSeatBooked(seatNum, bookedSeats)) return selectedSeats;
    const num = Number(seatNum);
    if (isNaN(num)) return selectedSeats;
    const idx = selectedSeats.map(Number).indexOf(num);
    if (idx > -1) {
        return selectedSeats.filter(s => Number(s) !== num);
    } else {
        return [...selectedSeats, num];
    }
}

// BusAdminView helper mock
function seatGendersForCurrentTicket(ticket, bookings = []) {
    const fromTicket = (ticket && (ticket.seatGenders || ticket.seat_genders)) ? (ticket.seatGenders || ticket.seat_genders) : {};
    const result = { ...fromTicket };

    if (ticket && Array.isArray(bookings)) {
        bookings
            .filter(b => Number(b.bus_ticket_id) === Number(ticket.id) && b.status !== 'cancelled')
            .forEach(b => {
                const seats = Array.isArray(b.seat_numbers) ? b.seat_numbers : (typeof b.seat_numbers === 'string' ? JSON.parse(b.seat_numbers || '[]') : []);
                const pData = Array.isArray(b.passengers_data) ? b.passengers_data : (typeof b.passengers_data === 'string' ? JSON.parse(b.passengers_data || '[]') : []);
                seats.forEach((s, idx) => {
                    const num = Number(s);
                    const g = pData[idx]?.gender;
                    if (!isNaN(num) && (g === 'male' || g === 'female') && !result[num]) {
                        result[num] = g;
                    }
                });
            });
    }
    return result;
}

describe('Phase E.37 — Carrier Seat Gender Display Unit Tests', () => {

    it('1. Booked male seat -> returns male booked class, disabled, not clickable', () => {
        const booked = [4];
        const genders = { 4: 'male' };
        const cls = getSeatClass(4, booked, genders, []);
        assert.equal(cls.includes('booked-male'), true);
        assert.equal(cls.includes('seat-male-booked'), true);
        assert.equal(isSeatBooked(4, booked), true);
        assert.deepEqual(toggleSeat(4, booked, []), []); // not clickable
    });

    it('2. Booked female seat -> returns female booked class, disabled, not clickable', () => {
        const booked = [9];
        const genders = { 9: 'female' };
        const cls = getSeatClass(9, booked, genders, []);
        assert.equal(cls.includes('booked-female'), true);
        assert.equal(cls.includes('seat-female-booked'), true);
        assert.equal(isSeatBooked(9, booked), true);
        assert.deepEqual(toggleSeat(9, booked, []), []); // not clickable
    });

    it('3. Booked unknown gender -> neutral booked color, disabled', () => {
        const booked = [15];
        const genders = {};
        const cls = getSeatClass(15, booked, genders, []);
        assert.equal(cls, 'seat-booked');
        assert.equal(cls.includes('booked-male'), false);
        assert.equal(cls.includes('booked-female'), false);
        assert.equal(isSeatBooked(15, booked), true);
    });

    it('4. Free premium seat -> premium color, clickable', () => {
        const booked = [];
        const genders = {};
        const cls = getSeatClass(1, booked, genders, [], 'double');
        assert.equal(cls, 'seat-premium');
        assert.equal(isSeatBooked(1, booked), false);
        assert.deepEqual(toggleSeat(1, booked, []), [1]); // clickable
    });

    it('5. Seat type normalization: string "4" vs number 4 works seamlessly', () => {
        const booked = [4];
        const genders = { "4": 'male' };
        assert.equal(getBookedSeatGender("4", booked, genders), 'male');
        assert.equal(getBookedSeatGender(4, ["4"], genders), 'male');
    });

    it('6. Male booked premium seat #4 -> male booked style wins over premium', () => {
        const booked = [4];
        const genders = { 4: 'male' };
        // Seat 4 is front row premium on double decker
        const cls = getSeatClass(4, booked, genders, [], 'double');
        assert.equal(cls.includes('booked-male'), true);
        assert.equal(cls.includes('seat-premium'), false);
    });

    it('7. Female booked premium seat #2 -> female booked style wins over premium', () => {
        const booked = [2];
        const genders = { 2: 'female' };
        const cls = getSeatClass(2, booked, genders, [], 'double');
        assert.equal(cls.includes('booked-female'), true);
        assert.equal(cls.includes('seat-premium'), false);
    });

    it('8. seatGendersForCurrentTicket cleanly resolves gender from ticket or bookings', () => {
        const ticket = { id: 73, seatGenders: { 4: 'male' } };
        const bookings = [
            {
                bus_ticket_id: 73,
                seat_numbers: [9],
                status: 'confirmed',
                passengers_data: [{ gender: 'female' }]
            }
        ];
        const result = seatGendersForCurrentTicket(ticket, bookings);
        assert.deepEqual(result, { 4: 'male', 9: 'female' });
    });

    it('9. Legacy booking without gender still renders neutral booked', () => {
        const ticket = { id: 73, seatGenders: {} };
        const bookings = [
            {
                bus_ticket_id: 73,
                seat_numbers: [12],
                status: 'confirmed',
                passengers_data: []
            }
        ];
        const result = seatGendersForCurrentTicket(ticket, bookings);
        assert.equal(result[12], undefined);
        const cls = getSeatClass(12, [12], result, []);
        assert.equal(cls, 'seat-booked');
    });

    it('10. No PII is present in seatGenders map', () => {
        const ticket = { id: 73, seatGenders: { 4: 'male' } };
        const bookings = [
            {
                bus_ticket_id: 73,
                seat_numbers: [4],
                status: 'confirmed',
                passengers_data: [{ lastName: 'Secret', phone: '+992921234567', gender: 'male' }]
            }
        ];
        const result = seatGendersForCurrentTicket(ticket, bookings);
        const serialized = JSON.stringify(result);
        assert.equal(serialized.includes('Secret'), false);
        assert.equal(serialized.includes('+992'), false);
    });

});
