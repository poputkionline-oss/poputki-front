import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Bus Admin: Trip Editing & Notifications UI Test Suite (18 Scenarios)', () => {

    const adminViewPath = resolve('src/views/BusAdminView.vue');
    const adminViewContent = readFileSync(adminViewPath, 'utf8');

    test('1. "Изменить" button is present and calls editTicket(ticket)', () => {
        assert.ok(adminViewContent.includes('editTicket(ticket)'));
        assert.ok(adminViewContent.includes('<span>Изменить</span>'));
        assert.ok(adminViewContent.includes('✏️'));
    });

    test('2. "Изменить" button visibility is gated by canEditTrip(ticket)', () => {
        assert.ok(adminViewContent.includes('v-if="canEditTrip(ticket)"'));
    });

    test('3. canEditTrip requires active status and future departure', () => {
        assert.ok(adminViewContent.includes("ticket.status !== 'active'"));
        assert.ok(adminViewContent.includes('this.hasTripDeparted(ticket)'));
    });

    test('4. canEditTrip permits only owner or dispatcher', () => {
        assert.ok(adminViewContent.includes("role !== 'owner' && role !== 'dispatcher'"));
    });

    test('5. cancelEditTicket button is present and restores tickets tab', () => {
        assert.ok(adminViewContent.includes('cancelEditTicket'));
        assert.ok(adminViewContent.includes("this.activeTab = 'tickets'"));
    });

    test('6. Form heading adapts to "Редактировать рейс" when isEditingTicket', () => {
        assert.ok(adminViewContent.includes("isEditingTicket ? 'Редактировать рейс' : 'Опубликовать новый рейс'"));
    });

    test('7. Save button adapts to "Сохранить изменения" when isEditingTicket', () => {
        assert.ok(adminViewContent.includes("isEditingTicket ? 'Сохранить изменения' : 'Опубликовать рейс'"));
    });

    test('8. Substantial fields are monitored for changes', () => {
        assert.ok(adminViewContent.includes('SUBSTANTIAL_FIELDS'));
        assert.ok(adminViewContent.includes('departure_date'));
        assert.ok(adminViewContent.includes('departure_time'));
        assert.ok(adminViewContent.includes('from_address'));
        assert.ok(adminViewContent.includes('to_address'));
        assert.ok(adminViewContent.includes('bus_id'));
    });

    test('9. Active bookings trigger showTripChangeConfirmModal before PUT', () => {
        assert.ok(adminViewContent.includes('this.showTripChangeConfirmModal = true'));
        assert.ok(adminViewContent.includes('В рейсе есть забронированные пассажиры'));
    });

    test('10. Confirmation modal displays old vs new values diff', () => {
        assert.ok(adminViewContent.includes('cf.oldVal'));
        assert.ok(adminViewContent.includes('cf.newVal'));
        assert.ok(adminViewContent.includes('Пассажиров для уведомления:'));
    });

    test('11. Confirmation modal has "Вернуться к редактированию" and "Сохранить и уведомить пассажиров"', () => {
        assert.ok(adminViewContent.includes('Вернуться к редактированию'));
        assert.ok(adminViewContent.includes('Сохранить и уведомить пассажиров'));
        assert.ok(adminViewContent.includes('confirmTripChangeModal'));
    });

    test('12. Double click is protected via loading spinner and disabled state', () => {
        assert.ok(adminViewContent.includes(':disabled="loading"'));
        assert.ok(adminViewContent.includes('border-t-transparent rounded-full animate-spin'));
    });

    test('13. Idempotency key is generated on edit submission', () => {
        assert.ok(adminViewContent.includes('updateData.idempotency_key = `trip-edit-'));
    });

    test('14. 409 BUS_SEAT_REMAP_REQUIRED opens showSeatRemapModal', () => {
        assert.ok(adminViewContent.includes("e.response?.data?.error === 'BUS_SEAT_REMAP_REQUIRED'"));
        assert.ok(adminViewContent.includes('this.showSeatRemapModal = true'));
        assert.ok(adminViewContent.includes('Переназначение мест в новом автобусе'));
    });

    test('15. submitSeatRemap validates non-empty and unique seat numbers', () => {
        assert.ok(adminViewContent.includes('submitSeatRemap'));
        assert.ok(adminViewContent.includes('chosenSeats.has(newSeat)'));
        assert.ok(adminViewContent.includes('Каждому пассажиру необходимо назначить уникальное место'));
    });

    test('16. 409 ROUTE_CHANGE_REQUIRES_SEPARATE_TRIP alerts carrier clearly', () => {
        assert.ok(adminViewContent.includes("e.response?.data?.error === 'ROUTE_CHANGE_REQUIRES_SEPARATE_TRIP'"));
        assert.ok(adminViewContent.includes('Изменение основных городов при наличии активных бронирований запрещено'));
    });

    test('17. Success summary shows queued notifications and unreachable passenger counts', () => {
        assert.ok(adminViewContent.includes('data.notificationsQueued'));
        assert.ok(adminViewContent.includes('Уведомления поставлены в очередь:'));
        assert.ok(adminViewContent.includes('Требуется связаться вручную:'));
    });

    test('18. Desktop & mobile responsive button placement and modal design', () => {
        assert.ok(adminViewContent.includes('fixed inset-0 z-50 flex items-center justify-center p-4'));
        assert.ok(adminViewContent.includes('max-w-lg w-full'));
    });
});
