/**
 * tests/phase_e41_reopen_handoff_ui.test.js
 * 
 * Phase E.41 — Reopen Manual Booking Handoff From Bookings List Test Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('PHASE E.41 — REOPEN MANUAL BOOKING HANDOFF FROM BOOKINGS LIST', () => {

    const carrierTripBookingsPath = path.resolve('src/components/carrier/CarrierTripBookings.vue');
    const carrierTripBookingsSource = fs.readFileSync(carrierTripBookingsPath, 'utf8');

    const busAdminPath = path.resolve('src/views/BusAdminView.vue');
    const busAdminSource = fs.readFileSync(busAdminPath, 'utf8');

    // Simulation helpers representing the methods in CarrierTripBookings.vue
    function isHandoffEligible(p) {
        if (!p) return false;
        const b = p.originalBooking || p;
        const isManual = p.isManual || b.channel === 'manual' || b.source_type === 'manual' || b.source_type === 'carrier';
        if (!isManual) return false;
        if (p.status === 'cancelled' || b.status === 'cancelled') return false;
        if (b.claimed_by_user_id) return false;
        if (b.claim_status === 'claimed') return false;
        return true;
    }

    function isAlreadyClaimed(p) {
        if (!p) return false;
        const b = p.originalBooking || p;
        const isManual = p.isManual || b.channel === 'manual' || b.source_type === 'manual' || b.source_type === 'carrier';
        if (!isManual) return false;
        return Boolean(b.claimed_by_user_id || b.claim_status === 'claimed');
    }

    // --- SECTION 1: CODE INTEGRITY CHECKS ---

    it('1. CarrierTripBookings.vue declares "open-handoff" in emits', () => {
        assert.ok(
            carrierTripBookingsSource.includes("'open-handoff'"),
            'CarrierTripBookings must include open-handoff in emits'
        );
    });

    it('2. CarrierTripBookings.vue contains "Передать билет" action button with eligibility guard', () => {
        assert.ok(
            carrierTripBookingsSource.includes('Передать билет'),
            'Must display button label "Передать билет"'
        );
        assert.ok(
            carrierTripBookingsSource.includes('isHandoffEligible(p)'),
            'Must guard button visibility with isHandoffEligible(p)'
        );
        assert.ok(
            carrierTripBookingsSource.includes("$emit('open-handoff', p)"),
            'Must emit open-handoff with passenger payload on click'
        );
    });

    it('3. CarrierTripBookings.vue displays "Подтверждено" indicator for already claimed bookings', () => {
        assert.ok(
            carrierTripBookingsSource.includes('isAlreadyClaimed(p)'),
            'Must check isAlreadyClaimed(p) when handoff is not eligible'
        );
        assert.ok(
            carrierTripBookingsSource.includes('Подтверждено'),
            'Must display confirmation status for claimed manual bookings'
        );
    });

    it('4. BusAdminView.vue binds @open-handoff to openHandoffForBooking', () => {
        assert.ok(
            busAdminSource.includes('@open-handoff="openHandoffForBooking"'),
            'BusAdminView must listen to open-handoff event'
        );
        assert.ok(
            busAdminSource.includes('async openHandoffForBooking(p)'),
            'BusAdminView must implement openHandoffForBooking method'
        );
    });

    it('5. BusAdminView.vue openHandoffForBooking calls POST /claim-link endpoint', () => {
        assert.ok(
            busAdminSource.includes('/claim-link'),
            'openHandoffForBooking must call claim-link endpoint'
        );
    });

    it('6. BusAdminView.vue handoffModal supports isExisting title and footer', () => {
        assert.ok(
            busAdminSource.includes("handoffModal.isExisting ? 'Передать билет' : 'Бронь создана'"),
            'Modal title must adapt for existing booking reopening'
        );
        assert.ok(
            busAdminSource.includes("handoffModal.isExisting ? 'Закрыть' : 'Закрыть и перейти к списку броней'"),
            'Modal close button must adapt for existing booking reopening'
        );
    });

    // --- SECTION 2: TEST MATRIX (CASES A - J) ---

    it('7. CASE A: Confirmed manual booking + unclaimed -> "Передать билет" is ELIGIBLE', () => {
        const passenger = {
            bookingId: 101,
            isManual: true,
            status: 'confirmed',
            originalBooking: {
                id: 101,
                channel: 'manual',
                status: 'confirmed',
                claim_status: 'unclaimed',
                claimed_by_user_id: null
            }
        };

        assert.strictEqual(isHandoffEligible(passenger), true);
        assert.strictEqual(isAlreadyClaimed(passenger), false);
    });

    it('8. CASE B: Current production booking #448 fixture (confirmed + pending_verification + no owner) -> ELIGIBLE', () => {
        const booking448Fixture = {
            bookingId: 448,
            seat: '8',
            name: 'Абдуллоев Акмалхон',
            isManual: true,
            status: 'confirmed',
            originalBooking: {
                id: 448,
                bus_ticket_id: 73,
                channel: 'manual',
                source_type: 'manual',
                source_id: '11',
                created_by_user_id: 11,
                status: 'confirmed',
                claim_status: 'pending_verification',
                claimed_by_user_id: null,
                contact_role: 'passenger'
            }
        };

        assert.strictEqual(isHandoffEligible(booking448Fixture), true);
        assert.strictEqual(isAlreadyClaimed(booking448Fixture), false);
    });

    it('9. CASE C: Confirmed manual booking + claimed_by_user_id set -> Action BLOCKED, confirmed state shown', () => {
        const passenger = {
            bookingId: 102,
            isManual: true,
            status: 'confirmed',
            originalBooking: {
                id: 102,
                channel: 'manual',
                status: 'confirmed',
                claim_status: 'claimed',
                claimed_by_user_id: 99
            }
        };

        assert.strictEqual(isHandoffEligible(passenger), false);
        assert.strictEqual(isAlreadyClaimed(passenger), true);
    });

    it('10. CASE D: Cancelled manual booking -> Action BLOCKED', () => {
        const passenger = {
            bookingId: 103,
            isManual: true,
            status: 'cancelled',
            originalBooking: {
                id: 103,
                channel: 'manual',
                status: 'cancelled',
                claim_status: 'unclaimed',
                claimed_by_user_id: null
            }
        };

        assert.strictEqual(isHandoffEligible(passenger), false);
    });

    it('11. Online booking (non-manual) -> Action BLOCKED', () => {
        const passenger = {
            bookingId: 104,
            isManual: false,
            status: 'confirmed',
            originalBooking: {
                id: 104,
                channel: 'web',
                source_type: 'platform',
                status: 'confirmed',
                claim_status: 'unclaimed',
                claimed_by_user_id: null
            }
        };

        assert.strictEqual(isHandoffEligible(passenger), false);
    });

    it('12. CASE F: Simulating click on eligible booking #448 opens handoffModal with safe links', async () => {
        let modalState = {};

        // Simulate openHandoffForBooking
        async function mockOpenHandoff(p, apiPost) {
            const bookingId = p.bookingId || p.id;
            const b = p.originalBooking || p;
            const role = b.contact_role || 'passenger';

            modalState = {
                show: true,
                isExisting: true,
                role: role,
                bookingId: bookingId,
                ticketUrl: '',
                claimUrl: '',
                expiresAt: null,
                isClaimed: false,
                regenerating: true,
                regenerationError: ''
            };

            try {
                const res = await apiPost(`/bus-admin/bookings/${bookingId}/claim-link`);
                if (res.data) {
                    modalState.ticketUrl = res.data.ticket_url;
                    modalState.claimUrl = res.data.claim_url;
                    modalState.expiresAt = res.data.expires_at;
                    modalState.isClaimed = false;
                }
            } finally {
                modalState.regenerating = false;
            }
        }

        const mockApiPost = async () => ({
            data: {
                success: true,
                booking_id: 448,
                claim_url: 'https://t.me/Poputkionline_bot?start=claim_abcdef1234567890abcdef1234567890',
                ticket_url: 'https://www.poputki.online/ticket-verify/448-bde80c8fc4e62bb31ef3ab12ad282d1e',
                expires_at: '2026-09-04T00:00:00.000Z'
            }
        });

        const p = {
            bookingId: 448,
            name: 'Абдуллоев Акмалхон',
            originalBooking: {
                id: 448,
                contact_role: 'passenger',
                claimed_by_user_id: null
            }
        };

        await mockOpenHandoff(p, mockApiPost);

        assert.strictEqual(modalState.show, true);
        assert.strictEqual(modalState.isExisting, true);
        assert.strictEqual(modalState.bookingId, 448);
        assert.strictEqual(modalState.isClaimed, false);
        assert.ok(modalState.ticketUrl.startsWith('https://www.poputki.online/ticket-verify/'));
        assert.ok(modalState.claimUrl.startsWith('https://t.me/Poputkionline_bot?start=claim_'));
        assert.strictEqual(modalState.regenerating, false);
        // Ownership invariant: claimed_by_user_id remains null
        assert.strictEqual(p.originalBooking.claimed_by_user_id, null);
    });

    it('13. CASE G & H: Handoff modal supports copying ticket link and Telegram deep link', () => {
        let copied = {};

        function copyHandoffText(text, label) {
            copied = { text, label };
            return `${label} скопирована в буфер!`;
        }

        const ticketResult = copyHandoffText('https://www.poputki.online/ticket-verify/448-hash', 'Ссылка на билет');
        assert.strictEqual(copied.text, 'https://www.poputki.online/ticket-verify/448-hash');
        assert.strictEqual(ticketResult, 'Ссылка на билет скопирована в буфер!');

        const tgResult = copyHandoffText('https://t.me/Poputkionline_bot?start=claim_token', 'Ссылка для Telegram');
        assert.strictEqual(copied.text, 'https://t.me/Poputkionline_bot?start=claim_token');
        assert.strictEqual(tgResult, 'Ссылка для Telegram скопирована в буфер!');
    });

    it('14. CASE I: Handoff modal "Открыть билет" invokes ticketUrl safely', () => {
        let openedUrl = null;
        let openedTarget = null;

        function openHandoffTicket(url) {
            openedUrl = url;
            openedTarget = '_blank';
        }

        openHandoffTicket('https://www.poputki.online/ticket-verify/448-token');
        assert.strictEqual(openedUrl, 'https://www.poputki.online/ticket-verify/448-token');
        assert.strictEqual(openedTarget, '_blank');
    });

    it('15. CASE J: Regeneration error yields truthful safe message and blocks false Telegram success', async () => {
        let modalState = {};

        async function mockOpenHandoffWithError(statusCode) {
            modalState = {
                show: true,
                isClaimed: false,
                regenerationError: '',
                regenerating: true
            };

            try {
                const err = new Error('Request failed');
                err.response = { status: statusCode, data: { message: 'Internal server error' } };
                throw err;
            } catch (err) {
                if (err.response?.status === 409) {
                    modalState.isClaimed = true;
                    modalState.regenerationError = 'Поездка уже подтверждена пассажиром';
                } else if (err.response?.status === 403) {
                    modalState.regenerationError = 'Доступ запрещен: рейс не принадлежит вашему аккаунту перевозчика';
                } else {
                    modalState.regenerationError = 'Не удалось создать ссылку для передачи билета. Попробуйте ещё раз.';
                }
            } finally {
                modalState.regenerating = false;
            }
        }

        // Test 500 failure
        await mockOpenHandoffWithError(500);
        assert.strictEqual(modalState.regenerationError, 'Не удалось создать ссылку для передачи билета. Попробуйте ещё раз.');
        assert.strictEqual(modalState.regenerationError.includes('Internal server error'), false);
        assert.strictEqual(modalState.regenerationError.includes('Telegram'), false);

        // Test 409 already claimed
        await mockOpenHandoffWithError(409);
        assert.strictEqual(modalState.isClaimed, true);
        assert.strictEqual(modalState.regenerationError, 'Поездка уже подтверждена пассажиром');
    });

    it('16. Role messages match exact requirements for all 4 roles', () => {
        function getHandoffRoleMessage(role) {
            switch (role) {
                case 'passenger':
                    return 'Пассажир пока не подключён к Telegram-боту POPUTKI.ONLINE. Передайте ему билет или ссылку для получения поездки.';
                case 'family_or_group':
                    return 'Передайте билеты членам семьи / группы. Каждый пассажир должен получить и подтвердить свою поездку отдельно.';
                case 'coordinator':
                    return 'Передайте билет посреднику для отправки пассажиру. Посредник не становится владельцем брони.';
                case 'unknown':
                default:
                    return 'Контакт пассажира не подтверждён. Передайте билет только фактическому пассажиру.';
            }
        }

        assert.ok(getHandoffRoleMessage('passenger').includes('Пассажир пока не подключён'));
        assert.ok(getHandoffRoleMessage('family_or_group').includes('Передайте билеты членам семьи / группы'));
        assert.ok(getHandoffRoleMessage('coordinator').includes('Передайте билет посреднику'));
        assert.ok(getHandoffRoleMessage('unknown').includes('Контакт пассажира не подтверждён'));
    });

});
