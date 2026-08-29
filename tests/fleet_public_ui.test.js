import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Fleet Phase E: Passenger Frontend Public Bus Details UI Suite', () => {

    const searchResultsPath = resolve('src/views/SearchResultsView.vue');
    const searchResultsContent = readFileSync(searchResultsPath, 'utf8');

    const detailsPath = resolve('src/views/BusTicketDetailsView.vue');
    const detailsContent = readFileSync(detailsPath, 'utf8');

    const bookingPath = resolve('src/views/BusBookingView.vue');
    const bookingContent = readFileSync(bookingPath, 'utf8');

    const mockFleetTicket = {
        id: 73,
        from_city: 'Нижневартовск (РФ)',
        to_city: 'Канибадам (TJ)',
        departure_date: '2026-09-16',
        departure_time: '00:30',
        arrival_date: '2026-09-19',
        arrival_time: '06:35',
        price: 700,
        bus_type: 'double',
        total_seats: 78,
        floor1_seats: 22,
        floor2_seats: 56,
        bus: {
            id: 1,
            brand: 'Setra',
            model: 'S 431 DT',
            license_plate: '5051ZA20',
            bus_type: 'double',
            total_seats: 78,
            floor1_seats: 22,
            floor2_seats: 56,
            amenities: ['wifi', 'ac', 'tv', 'wc'],
            year_built: 2014,
            color: 'Черный',
            photos: [{ url: 'https://res.cloudinary.com/main.jpg', is_main: true }]
        },
        photos: [{ url: 'https://res.cloudinary.com/main.jpg', is_main: true }]
    };

    const mockLegacyTicket = {
        id: 10,
        from_city: 'Худжанд',
        to_city: 'Душанбе',
        departure_date: '2026-09-01',
        departure_time: '08:00',
        price: 120,
        bus_type: 'single',
        total_seats: 50,
        bus: null,
        photos: []
    };

    test('1. Trip card conditionally renders bus details badge when ticket.bus is present', () => {
        assert.ok(searchResultsContent.includes('v-if="ticket.bus"'));
        assert.ok(searchResultsContent.includes('ticket.bus.brand'));
        assert.ok(searchResultsContent.includes('ticket.bus.model'));
    });

    test('2. Legacy ticket with bus=null leaves search result card clean without empty placeholders', () => {
        assert.ok(!searchResultsContent.includes('Автобус: данных нет'));
        assert.ok(!searchResultsContent.includes('Данных нет'));
    });

    test('3. Card displays brand and model cleanly', () => {
        assert.ok(searchResultsContent.includes('{{ ticket.bus.brand }} {{ ticket.bus.model }}'));
    });

    test('4. Card displays bus type and capacity', () => {
        assert.ok(searchResultsContent.includes("ticket.bus.bus_type === 'double' ? 'Двухэтажный' : 'Одноэтажный'"));
        assert.ok(searchResultsContent.includes('{{ ticket.bus.total_seats }} мест'));
    });

    test('5. Amenity dictionary mapping is present in SearchResultsView', () => {
        assert.ok(searchResultsContent.includes('amenityLabels'));
        assert.ok(searchResultsContent.includes("wifi: 'Wi-Fi'"));
        assert.ok(searchResultsContent.includes("ac: 'Кондиционер'"));
        assert.ok(searchResultsContent.includes("wc: 'Туалет'"));
    });

    test('6. Details view contains dedicated bus section guarded by ticket.bus', () => {
        assert.ok(detailsContent.includes('v-if="ticket?.bus"'));
        assert.ok(detailsContent.includes('ticket.bus.brand'));
        assert.ok(detailsContent.includes('ticket.bus.model'));
    });

    test('7. Details view renders license plate badge', () => {
        assert.ok(detailsContent.includes('ticket.bus.license_plate'));
        assert.ok(detailsContent.includes('v-if="ticket.bus.license_plate"'));
    });

    test('8. Details view renders bus type badge', () => {
        assert.ok(detailsContent.includes("ticket.bus.bus_type === 'double' ? 'Двухэтажный' : 'Одноэтажный'"));
    });

    test('9. Details view renders floor breakdown for double-decker', () => {
        assert.ok(detailsContent.includes("v-if=" + '"' + "ticket.bus.bus_type === 'double'" + '"'));
        assert.ok(detailsContent.includes('ticket.bus.floor1_seats'));
        assert.ok(detailsContent.includes('ticket.bus.floor2_seats'));
    });

    test('10. Details view renders year built and color when present', () => {
        assert.ok(detailsContent.includes('v-if="ticket.bus.year_built"'));
        assert.ok(detailsContent.includes('v-if="ticket.bus.color"'));
    });

    test('11. Details view renders amenities list with friendly chips', () => {
        assert.ok(detailsContent.includes('v-if="ticket.bus.amenities && ticket.bus.amenities.length > 0"'));
        assert.ok(detailsContent.includes('v-for="amenity in ticket.bus.amenities"'));
        assert.ok(detailsContent.includes('amenityLabels[amenity] || amenity'));
    });

    test('12. Details view gallery remains null-safe when photos are empty', () => {
        assert.ok(detailsContent.includes('v-if="ticket?.photos?.length > 0"'));
    });

    test('13. Archived or active bus data renders safely without status leakage', () => {
        assert.ok(!detailsContent.includes('ticket.bus.status'));
    });

    test('14. Legacy ticket with bus=null hides bus section completely on details view', () => {
        assert.ok(detailsContent.includes('v-if="ticket?.bus"'));
    });

    test('15. Sensitive VIN is never rendered in SearchResultsView or BusTicketDetailsView', () => {
        assert.ok(!searchResultsContent.includes('ticket.bus.vin'));
        assert.ok(!detailsContent.includes('ticket.bus.vin'));
    });

    test('16. Internal notes are never rendered', () => {
        assert.ok(!searchResultsContent.includes('ticket.bus.notes'));
        assert.ok(!detailsContent.includes('ticket.bus.notes'));
    });

    test('17. carrier_id is never rendered in public views', () => {
        assert.ok(!searchResultsContent.includes('ticket.bus.carrier_id'));
        assert.ok(!detailsContent.includes('ticket.bus.carrier_id'));
    });

    test('18. Seat selector component in BusBookingView remains untouched and functional', () => {
        assert.ok(bookingContent.includes('<BusSeatSelector'));
        assert.ok(bookingContent.includes(':floor1Seats='));
        assert.ok(bookingContent.includes(':floor2Seats='));
    });

    test('19. Booking submission flow in BusBookingView remains intact', () => {
        assert.ok(detailsContent.includes('startBooking'));
        assert.ok(bookingContent.includes('confirmBooking'));
        assert.ok(bookingContent.includes('canProceedStep1'));
        assert.ok(bookingContent.includes('canProceedStep2'));
    });

    test('20. Premium seat pricing calculations remain intact in BusBookingView', () => {
        assert.ok(bookingContent.includes('premiumSeats'));
        assert.ok(bookingContent.includes('premiumPrice'));
        assert.ok(bookingContent.includes('totalPrice'));
    });

    test('21. Route cities, duration, dates, and times render accurately', () => {
        assert.ok(detailsContent.includes('ticket.departure_time'));
        assert.ok(detailsContent.includes('ticket.arrival_time'));
        assert.ok(detailsContent.includes('ticket.from_city'));
        assert.ok(detailsContent.includes('ticket.to_city'));
    });

    test('22. Mobile responsive classes used for layout and cards', () => {
        assert.ok(searchResultsContent.includes('hidden sm:flex'));
        assert.ok(detailsContent.includes('grid-cols-2 sm:grid-cols-3'));
    });

    test('23. Details fullscreen photo viewer modal remains functional', () => {
        assert.ok(detailsContent.includes('showPhotoModal'));
        assert.ok(detailsContent.includes('openFullScreen'));
    });

    test('24. Null-safe checks prevent blank screens or crashes when bus fields are null', () => {
        assert.ok(detailsContent.includes('ticket?.bus'));
        assert.ok(searchResultsContent.includes('ticket.bus'));
    });

    test('25. Carrier cabinet administration view is not modified or regressed', () => {
        const busAdminPath = resolve('src/views/BusAdminView.vue');
        const busAdminContent = readFileSync(busAdminPath, 'utf8');
        assert.ok(busAdminContent.includes('activeTab'));
        assert.ok(busAdminContent.includes('fetchFleetBuses'));
    });
});
