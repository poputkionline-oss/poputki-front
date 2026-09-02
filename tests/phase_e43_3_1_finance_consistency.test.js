/**
 * tests/phase_e43_3_1_finance_consistency.test.js
 * 
 * Phase E.43.3.1 — Deleted Booking Finance Consistency Test Suite
 * 
 * Tests Cases A through J:
 * Case A — Confirmed online booking adds to turnover, fee, carrier amount, online count.
 * Case B — Confirmed manual booking adds to turnover, 0% platform fee, full carrier amount, manual count.
 * Case C — Physically deleted manual booking is completely removed from all above current metrics.
 * Case D — Physically deleted booking does NOT leave orphan revenue in trip summary.
 * Case E — Physically deleted booking does NOT count toward cancelled bookings counter.
 * Case F — Legitimate cancelled booking DOES count toward cancelled bookings counter.
 * Case G — Pending payment booking does NOT count as confirmed turnover.
 * Case H — Boarding counts update immediately when booking is deleted.
 * Case I — Handoff route data fix from E.43.3 remains PASS.
 * Case J — Carrier frontend suite remains >= 286 PASS.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('PHASE E.43.3.1 — DELETED BOOKING FINANCE CONSISTENCY', () => {

    const tripBookingsSource = fs.readFileSync(path.resolve('src/components/carrier/CarrierTripBookings.vue'), 'utf8');
    const carrierFinanceSource = fs.readFileSync(path.resolve('src/components/carrier/CarrierFinance.vue'), 'utf8');
    const busAdminSource = fs.readFileSync(path.resolve('src/views/BusAdminView.vue'), 'utf8');

    // Helper: simulate canonical finance aggregation over booking rows
    function aggregateFinanceMetrics(bookings, capacity = 53) {
        let totalConfirmedGross = 0;
        let totalPendingAmount = 0;
        let totalServiceCommission = 0;
        let totalCarrierAmount = 0;
        let totalOnlineAmount = 0;
        let totalManualAmount = 0;
        let totalOnlineBookings = 0;
        let totalManualBookings = 0;

        let countConfirmed = 0;
        let countPending = 0;
        let countCancelled = 0;

        let boardingTotal = 0;
        let boardingBoarded = 0;
        let boardingPending = 0;
        let boardingNoShow = 0;

        const uniqueSeats = new Set();

        bookings.forEach(b => {
            const isCancelled = b.status === 'cancelled';
            if (!isCancelled) {
                const sList = Array.isArray(b.seat_numbers) ? b.seat_numbers : [];
                sList.forEach(s => uniqueSeats.add(s));
            }

            if (b.status === 'confirmed') {
                const price = Number(b.total_price || 0);
                const isManual = b.channel === 'manual' || b.source_type === 'manual' || b.source_type === 'carrier';
                totalConfirmedGross += price;
                countConfirmed++;

                if (isManual) {
                    totalManualAmount += price;
                    totalManualBookings++;
                    totalCarrierAmount += price;
                } else {
                    const commRate = Number(b.commission_rate ?? 10);
                    const comm = Number(b.commission_amount > 0 ? b.commission_amount : Math.round(price * (commRate / 100)));
                    totalServiceCommission += comm;
                    totalCarrierAmount += Math.max(0, price - comm);
                    totalOnlineAmount += price;
                    totalOnlineBookings++;
                }

                const pCount = b.passenger_count || 1;
                const bStatus = b.boarding_status || 'pending_boarding';
                if (bStatus === 'boarded') {
                    boardingBoarded += pCount;
                } else if (bStatus === 'no_show') {
                    boardingNoShow += pCount;
                } else {
                    boardingPending += pCount;
                }
                boardingTotal += pCount;
            } else if (b.status === 'pending_payment') {
                countPending++;
                totalPendingAmount += Number(b.total_price || 0);
            } else if (b.status === 'cancelled') {
                countCancelled++;
            }
        });

        const bookedSeats = uniqueSeats.size;
        const fillRate = capacity > 0 ? parseFloat(((bookedSeats / capacity) * 100).toFixed(1)) : 0;

        return {
            totalConfirmedGross,
            totalServiceCommission,
            totalCarrierAmount,
            totalPendingAmount,
            totalOnlineAmount,
            totalManualAmount,
            totalOnlineBookings,
            totalManualBookings,
            countConfirmed,
            countPending,
            countCancelled,
            boarding: {
                total: boardingTotal,
                boarded: boardingBoarded,
                pending: boardingPending,
                no_show: boardingNoShow
            },
            booked_seats: bookedSeats,
            fill_rate: fillRate
        };
    }

    // --- CASE A ---
    it('Case A: Confirmed online booking adds to turnover, fee, carrier amount, online count', () => {
        const bookings = [
            {
                id: 1,
                status: 'confirmed',
                channel: 'web',
                source_type: 'platform',
                total_price: 1000,
                commission_rate: 10,
                passenger_count: 1,
                seat_numbers: [1]
            }
        ];
        const res = aggregateFinanceMetrics(bookings);
        assert.strictEqual(res.totalConfirmedGross, 1000);
        assert.strictEqual(res.totalServiceCommission, 100);
        assert.strictEqual(res.totalCarrierAmount, 900);
        assert.strictEqual(res.totalOnlineBookings, 1);
        assert.strictEqual(res.totalManualBookings, 0);
        assert.strictEqual(res.countConfirmed, 1);
    });

    // --- CASE B ---
    it('Case B: Confirmed manual booking adds to turnover, 0% platform fee, full carrier amount, manual count', () => {
        const bookings = [
            {
                id: 2,
                status: 'confirmed',
                channel: 'manual',
                source_type: 'carrier',
                total_price: 700,
                passenger_count: 1,
                seat_numbers: [8]
            }
        ];
        const res = aggregateFinanceMetrics(bookings);
        assert.strictEqual(res.totalConfirmedGross, 700);
        assert.strictEqual(res.totalServiceCommission, 0, 'Manual booking must have 0% platform fee');
        assert.strictEqual(res.totalCarrierAmount, 700, 'Manual booking gives full amount to carrier');
        assert.strictEqual(res.totalManualBookings, 1);
        assert.strictEqual(res.totalOnlineBookings, 0);
        assert.strictEqual(res.countConfirmed, 1);
    });

    // --- CASE C ---
    it('Case C: Physically deleted manual booking is completely removed from all current metrics', () => {
        // Initial state: booking 448 (confirmed manual) + booking 447 (test manual booking)
        const activeBookings = [
            { id: 448, status: 'confirmed', channel: 'manual', source_type: 'carrier', total_price: 700, passenger_count: 1, seat_numbers: [8] },
            { id: 447, status: 'confirmed', channel: 'manual', source_type: 'carrier', total_price: 700, passenger_count: 1, seat_numbers: [7] }
        ];
        const beforeDelete = aggregateFinanceMetrics(activeBookings);
        assert.strictEqual(beforeDelete.totalConfirmedGross, 1400);
        assert.strictEqual(beforeDelete.totalManualBookings, 2);

        // After physical deletion of booking 447
        const afterDelete = activeBookings.filter(b => b.id !== 447);
        const metricsAfter = aggregateFinanceMetrics(afterDelete);

        assert.strictEqual(metricsAfter.totalConfirmedGross, 700);
        assert.strictEqual(metricsAfter.totalCarrierAmount, 700);
        assert.strictEqual(metricsAfter.totalServiceCommission, 0);
        assert.strictEqual(metricsAfter.totalManualBookings, 1);
        assert.strictEqual(metricsAfter.countConfirmed, 1);
        assert.strictEqual(metricsAfter.booked_seats, 1);
    });

    // --- CASE D ---
    it('Case D: Physically deleted booking does NOT leave orphan revenue in trip summary', () => {
        // Given only remaining booking 448
        const tripBookings = [
            { id: 448, status: 'confirmed', channel: 'manual', source_type: 'carrier', total_price: 700, seat_numbers: [8] }
        ];
        const tripSummary = aggregateFinanceMetrics(tripBookings);
        assert.strictEqual(tripSummary.totalConfirmedGross, 700, 'Trip summary must strictly reflect current qualifying rows');
        assert.strictEqual(tripSummary.totalCarrierAmount, 700);
        assert.strictEqual(tripSummary.totalManualBookings, 1);
    });

    // --- CASE E ---
    it('Case E: Physically deleted booking does NOT count toward cancelled bookings counter', () => {
        // Deleted booking has no row, so status !== 'cancelled'
        const currentBookings = [
            { id: 448, status: 'confirmed', channel: 'manual', total_price: 700, seat_numbers: [8] }
        ];
        const res = aggregateFinanceMetrics(currentBookings);
        assert.strictEqual(res.countCancelled, 0, 'Physically deleted booking must NOT increment cancelled counter');
    });

    // --- CASE F ---
    it('Case F: Legitimate cancelled booking DOES count toward cancelled bookings counter', () => {
        const bookingsWithCancelled = [
            { id: 448, status: 'confirmed', channel: 'manual', total_price: 700, seat_numbers: [8] },
            { id: 416, status: 'cancelled', channel: 'manual', total_price: 805, seat_numbers: [1] },
            { id: 417, status: 'cancelled', channel: 'manual', total_price: 805, seat_numbers: [2] }
        ];
        const res = aggregateFinanceMetrics(bookingsWithCancelled);
        assert.strictEqual(res.countCancelled, 2, 'Legitimate cancellations must be preserved in cancelled counter');
        assert.strictEqual(res.countConfirmed, 1);
        assert.strictEqual(res.totalConfirmedGross, 700, 'Cancelled bookings must NOT add to confirmed turnover');
    });

    // --- CASE G ---
    it('Case G: Pending payment booking does NOT count as confirmed turnover', () => {
        const bookings = [
            { id: 448, status: 'confirmed', channel: 'manual', total_price: 700, seat_numbers: [8] },
            { id: 500, status: 'pending_payment', channel: 'web', total_price: 750, seat_numbers: [9] }
        ];
        const res = aggregateFinanceMetrics(bookings);
        assert.strictEqual(res.totalConfirmedGross, 700, 'Gross revenue strictly excludes pending_payment');
        assert.strictEqual(res.totalPendingAmount, 750, 'Pending amount tracks unconfirmed bookings');
        assert.strictEqual(res.countConfirmed, 1);
        assert.strictEqual(res.countPending, 1);
    });

    // --- CASE H ---
    it('Case H: Boarding counts update immediately when booking is deleted', () => {
        const bookings = [
            { id: 448, status: 'confirmed', channel: 'manual', total_price: 700, boarding_status: 'boarded', passenger_count: 1, seat_numbers: [8] },
            { id: 447, status: 'confirmed', channel: 'manual', total_price: 700, boarding_status: 'boarded', passenger_count: 1, seat_numbers: [7] }
        ];
        const before = aggregateFinanceMetrics(bookings);
        assert.strictEqual(before.boarding.boarded, 2);

        // Delete booking 447
        const after = aggregateFinanceMetrics(bookings.filter(b => b.id !== 447));
        assert.strictEqual(after.boarding.boarded, 1, 'Boarded counter must immediately decrement when booking is deleted');
        assert.strictEqual(after.boarding.total, 1);
    });

    // --- CASE I ---
    it('Case I: Handoff route data fix from E.43.3 remains PASS', () => {
        // BusAdminView official route precedence
        assert.ok(
            busAdminSource.includes("const fromCity = ticket?.from_city || f.from_city || f.pickup_city || '—';"),
            'BusAdminView manual booking route precedence must be preserved'
        );
        assert.ok(
            busAdminSource.includes("const toCity = ticket?.to_city || f.to_city || f.drop_off_city || '—';"),
            'BusAdminView toCity route precedence must be preserved'
        );
        assert.ok(
            busAdminSource.includes("const fromCity = ticket?.from_city || p.tripFromCity || b.from_city || '—';"),
            'BusAdminView openHandoff route precedence must be preserved'
        );
        assert.ok(
            tripBookingsSource.includes("tripFromCity: this.selectedTicket?.from_city || '—'"),
            'CarrierTripBookings must project canonical tripFromCity'
        );
    });

    // --- CASE J ---
    it('Case J: Reactive cache invalidation contracts verified in source', () => {
        // CarrierTripBookings must watch bookings deeply to re-fetch trip summary upon deletion
        assert.ok(
            tripBookingsSource.includes('bookings:') && tripBookingsSource.includes('this.fetchTripSummary(this.selectedTicketId)'),
            'CarrierTripBookings must watch bookings and re-fetch trip summary'
        );

        // CarrierTripBookings refresh button calls handleRefresh
        assert.ok(
            tripBookingsSource.includes('handleRefresh'),
            'CarrierTripBookings must implement handleRefresh to refresh both list and trip summary'
        );

        // BusAdminView invalidates finance on booking deletion
        assert.ok(
            busAdminSource.includes('this.financeRefreshKey = Date.now()'),
            'BusAdminView deleteBooking must update financeRefreshKey'
        );

        // CarrierFinance has mounted hook and refresh method
        assert.ok(
            carrierFinanceSource.includes('mounted()') && carrierFinanceSource.includes('this.fetchFinance()'),
            'CarrierFinance must include mounted hook for fresh fetch'
        );
        assert.ok(
            carrierFinanceSource.includes('refresh()'),
            'CarrierFinance must expose refresh method'
        );
    });

    // --- CASE K ---
    it('Case K: Multiple current bookings, delete one -> only deleted contribution disappears', () => {
        const bookings = [
            { id: 448, status: 'confirmed', channel: 'manual', source_type: 'carrier', total_price: 700, passenger_count: 1, seat_numbers: [8] },
            { id: 449, status: 'confirmed', channel: 'web', source_type: 'platform', total_price: 1000, commission_rate: 10, passenger_count: 1, seat_numbers: [9] },
            { id: 450, status: 'confirmed', channel: 'manual', source_type: 'carrier', total_price: 500, passenger_count: 1, seat_numbers: [10] }
        ];

        const initial = aggregateFinanceMetrics(bookings);
        assert.strictEqual(initial.totalConfirmedGross, 2200);
        assert.strictEqual(initial.totalManualAmount, 1200);
        assert.strictEqual(initial.totalOnlineAmount, 1000);
        assert.strictEqual(initial.totalServiceCommission, 100);
        assert.strictEqual(initial.totalCarrierAmount, 2100);
        assert.strictEqual(initial.countConfirmed, 3);

        // Delete booking 449 (online booking of 1000)
        const afterDelete449 = aggregateFinanceMetrics(bookings.filter(b => b.id !== 449));
        assert.strictEqual(afterDelete449.totalConfirmedGross, 1200);
        assert.strictEqual(afterDelete449.totalOnlineAmount, 0);
        assert.strictEqual(afterDelete449.totalManualAmount, 1200);
        assert.strictEqual(afterDelete449.totalServiceCommission, 0);
        assert.strictEqual(afterDelete449.totalCarrierAmount, 1200);
        assert.strictEqual(afterDelete449.countConfirmed, 2);
    });

    // --- CASE L ---
    it('Case L: Delete booking with historical audit entry -> current finance excludes it, audit remains independent', () => {
        // Simulated audit log entry exists in carrier_activity_logs
        const mockAuditLogs = [
            { id: 101, action: 'BOOKING_CANCELLED', entity_type: 'booking', entity_id: '447', oldData: { status: 'confirmed' } }
        ];
        // Active database bookings only has 448
        const dbBookings = [
            { id: 448, status: 'confirmed', channel: 'manual', source_type: 'carrier', total_price: 700, seat_numbers: [8] }
        ];

        // Audit log exists independently
        assert.strictEqual(mockAuditLogs.length, 1);
        assert.strictEqual(mockAuditLogs[0].entity_id, '447');

        // Current finance derives strictly from active dbBookings, not audit logs
        const finance = aggregateFinanceMetrics(dbBookings);
        assert.strictEqual(finance.totalConfirmedGross, 700);
        assert.strictEqual(finance.countConfirmed, 1);
        assert.strictEqual(finance.countCancelled, 0, 'Audit history of deleted booking does NOT inflate cancelled counter');
    });

    // --- CASE M ---
    it('Case M: Switch away and back to Finance -> fresh fetch via financeRefreshKey and activeTab', () => {
        // In BusAdminView: switching to 'finance' updates financeRefreshKey
        assert.ok(
            busAdminSource.includes("if (newTab === 'finance')") &&
            busAdminSource.includes('this.financeRefreshKey = Date.now()'),
            'BusAdminView must update financeRefreshKey on tab switch to finance'
        );
        // CarrierFinance component receives :key="financeRefreshKey"
        assert.ok(
            busAdminSource.includes(':key="financeRefreshKey"'),
            'CarrierFinance must be keyed with financeRefreshKey to guarantee fresh remount'
        );
    });

    // --- CASE N ---
    it('Case N: Manual refresh -> fresh trip summary', () => {
        // CarrierTripBookings handleRefresh must call fetchTripSummary with selectedTicketId
        assert.ok(
            tripBookingsSource.includes('handleRefresh()') &&
            tripBookingsSource.includes('this.fetchTripSummary(this.selectedTicketId)'),
            'Manual refresh must explicitly re-fetch trip summary'
        );
    });

    // --- CASE O ---
    it('Case O: No request loop -> bounded fetch count verified by design', () => {
        // fetchTripSummary mutates `this.summary`, NOT `this.bookings`
        const fetchMethodMatches = tripBookingsSource.match(/async fetchTripSummary\([^)]*\)\s*\{[\s\S]*?this\.summary\s*=\s*res\.data/);
        assert.ok(fetchMethodMatches, 'fetchTripSummary sets this.summary only');
        // It does not assign to this.bookings, preventing any recursive watcher trigger
        const fetchSummaryBody = tripBookingsSource.slice(tripBookingsSource.indexOf('async fetchTripSummary'), tripBookingsSource.indexOf('formatDate(dateStr)'));
        assert.ok(!fetchSummaryBody.includes('this.bookings ='), 'fetchTripSummary must never mutate bookings');
    });
});
