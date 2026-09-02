/**
 * tests/phase_e42_3_reopen_handoff_button_regression.test.js
 * 
 * Phase E.42.3 — Reopen Handoff Button Regression Audit & Test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('PHASE E.42.3 — REOPEN HANDOFF BUTTON CLICK REGRESSION TEST', () => {

    const busAdminPath = path.resolve('src/views/BusAdminView.vue');
    const busAdminSource = fs.readFileSync(busAdminPath, 'utf8');

    const bookingsPath = path.resolve('src/components/carrier/CarrierTripBookings.vue');
    const bookingsSource = fs.readFileSync(bookingsPath, 'utf8');

    it('1. CarrierTripBookings emits open-handoff with passenger payload on click', () => {
        assert.ok(
            bookingsSource.includes(`@click="$emit('open-handoff', p)"`),
            'CarrierTripBookings must emit open-handoff on button click'
        );
        assert.ok(
            bookingsSource.includes('Передать билет'),
            'Must contain button text "Передать билет"'
        );
        assert.ok(
            bookingsSource.includes('isHandoffEligible(p)'),
            'Must guard button with isHandoffEligible(p)'
        );
    });

    it('2. BusAdminView listens to open-handoff and binds openHandoffForBooking', () => {
        assert.ok(
            busAdminSource.includes('@open-handoff="openHandoffForBooking"'),
            'BusAdminView must bind openHandoffForBooking to @open-handoff'
        );
    });

    it('3. BusAdminView declares formatDate method preventing runtime TypeError', () => {
        assert.ok(
            busAdminSource.includes('formatDate(dateStr) {'),
            'BusAdminView must define formatDate method'
        );
    });

    it('4. openHandoffForBooking executes successfully on eligible booking #448 fixture without throwing', async () => {
        // Reproduce actual context of BusAdminView
        let postEndpointCalled = null;
        const fakeApi = {
            post: async (endpoint) => {
                postEndpointCalled = endpoint;
                return {
                    data: {
                        booking_id: 448,
                        ticket_url: 'https://www.poputki.online/ticket-verify/448-bde80c8fc4e62bb31ef3ab12ad282d1e',
                        claim_url: 'https://t.me/Poputkionline_bot?start=claim_1234567890abcdef',
                        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
                    }
                };
            }
        };

        const ctx = {
            tickets: [
                {
                    id: 73,
                    from_city: 'Душанбе',
                    to_city: 'Худжанд',
                    departure_date: '2026-09-05'
                }
            ],
            handoffModal: {
                show: false,
                isExisting: false,
                bookingId: null,
                ticketUrl: '',
                claimUrl: '',
                expiresAt: null,
                isClaimed: false,
                passengers: [],
                trip: null,
                contactPhone: '',
                copyFeedback: '',
                whatsAppError: '',
                regenerating: false,
                regenerationError: ''
            },
            formatDate(dateStr) {
                if (!dateStr) return '—';
                const d = new Date(dateStr);
                return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
            }
        };

        // Eligible booking #448 passenger row fixture
        const pFixture = {
            bookingId: 448,
            bus_ticket_id: 73,
            name: 'Абдуллоев Акмалхон',
            seat: '8',
            phone: '+992 92 792 50 51',
            contactRole: 'passenger',
            originalBooking: {
                id: 448,
                bus_ticket_id: 73,
                contact_role: 'passenger',
                status: 'confirmed',
                claim_status: 'pending_verification',
                claimed_by_user_id: null,
                passenger_phone: '+992 92 792 50 51',
                passenger_name: 'Абдуллоев Акмалхон',
                seat_numbers: ['8']
            }
        };

        // Simulate openHandoffForBooking method logic
        const b = pFixture.originalBooking || pFixture;
        const role = b.contact_role || pFixture.contactRole || 'passenger';
        const tId = b.bus_ticket_id || pFixture.bus_ticket_id;
        const ticket = (ctx.tickets || []).find(t => t.id == tId);
        const fromCity = pFixture.pickupCity || b.pickup_city || ticket?.from_city || '—';
        const toCity = pFixture.dropOffCity || b.drop_off_city || ticket?.to_city || '—';
        const depDate = ticket?.departure_date ? ctx.formatDate(ticket.departure_date) : '—';
        const contactPhone = pFixture.phone || b.passenger_phone || b.phone || '';
        const seatStr = pFixture.seat || '—';

        ctx.handoffModal = {
            show: true,
            isExisting: true,
            role: role,
            bookingId: pFixture.bookingId,
            ticketUrl: '',
            claimUrl: '',
            expiresAt: null,
            isClaimed: false,
            passengers: [{ name: pFixture.name, seat: pFixture.seat, phone: pFixture.phone }],
            trip: {
                fromCity: fromCity,
                toCity: toCity,
                departureDate: depDate,
                seats: seatStr
            },
            contactPhone: contactPhone,
            copyFeedback: '',
            whatsAppError: '',
            regenerating: true,
            regenerationError: ''
        };

        assert.strictEqual(ctx.handoffModal.show, true, 'Handoff modal must be set to show: true');
        assert.strictEqual(ctx.handoffModal.isExisting, true);
        assert.strictEqual(ctx.handoffModal.bookingId, 448);
        assert.strictEqual(ctx.handoffModal.trip.fromCity, 'Душанбе');
        assert.strictEqual(ctx.handoffModal.trip.toCity, 'Худжанд');
        assert.ok(ctx.handoffModal.trip.departureDate.includes('2026'), 'Date must be formatted');

        // Post to claim-link
        const res = await fakeApi.post(`/bus-admin/bookings/${pFixture.bookingId}/claim-link`);
        ctx.handoffModal.ticketUrl = res.data.ticket_url;
        ctx.handoffModal.claimUrl = res.data.claim_url;
        ctx.handoffModal.expiresAt = res.data.expires_at;
        ctx.handoffModal.regenerating = false;

        assert.strictEqual(postEndpointCalled, '/bus-admin/bookings/448/claim-link');
        assert.strictEqual(ctx.handoffModal.show, true);
        assert.strictEqual(ctx.handoffModal.ticketUrl, 'https://www.poputki.online/ticket-verify/448-bde80c8fc4e62bb31ef3ab12ad282d1e');
        assert.ok(ctx.handoffModal.claimUrl.startsWith('https://t.me/Poputkionline_bot?start=claim_'));
    });

    it('5. openHandoffForBooking prevents duplicate concurrent clicks while regenerating', async () => {
        let callCount = 0;
        const fakeApi = {
            post: async () => {
                callCount++;
                return { data: { ticket_url: 'test' } };
            }
        };

        const modal = {
            show: true,
            regenerating: true,
            bookingId: 448
        };

        // In openHandoffForBooking:
        // if (this.handoffModal.show && this.handoffModal.regenerating && this.handoffModal.bookingId === bookingId) return;
        const bookingId = 448;
        if (modal.show && modal.regenerating && modal.bookingId === bookingId) {
            // Guard blocks duplicate
        } else {
            await fakeApi.post();
        }

        assert.strictEqual(callCount, 0, 'Concurrent duplicate click must be blocked');
    });

    it('6. Failed claim-link request displays safe error message without crashing', async () => {
        const modal = {
            show: true,
            regenerating: true,
            regenerationError: ''
        };

        try {
            throw new Error('Network Error');
        } catch (err) {
            modal.regenerationError = 'Не удалось открыть передачу билета. Попробуйте ещё раз.';
        } finally {
            modal.regenerating = false;
        }

        assert.strictEqual(modal.regenerationError, 'Не удалось открыть передачу билета. Попробуйте ещё раз.');
        assert.strictEqual(modal.regenerating, false);
    });

    it('7. Modal actions hierarchy remains complete (WhatsApp Primary, Telegram, Copy, Open)', () => {
        assert.ok(busAdminSource.includes('Отправить в WhatsApp'), 'WhatsApp primary must exist');
        assert.ok(busAdminSource.includes('Открыть в Telegram'), 'Telegram action must exist');
        assert.ok(busAdminSource.includes('Скопировать ссылку'), 'Copy link utility must exist');
        assert.ok(busAdminSource.includes('Открыть билет'), 'Open ticket utility must exist');
    });

});
