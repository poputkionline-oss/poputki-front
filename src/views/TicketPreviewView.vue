<script>
import PassengerTicket from '../components/ticket/PassengerTicket.vue';

export default {
    name: 'TicketPreviewView',
    components: {
        PassengerTicket
    },
    data() {
        return {
            mockTicket: {
                brand: 'POPUTKI.ONLINE',
                ticketNumber: 'POP-000139',
                bookingId: 139,
                verificationToken: '139-8ead733aafec5e6f646d0d5fe696f6f2',
                verificationUrl: 'https://www.poputki.online/ticket/139-8ead733aafec5e6f646d0d5fe696f6f2',
                status: 'confirmed',
                statusLabel: 'Подтвержден',
                isValid: true,
                isPendingPayment: false,
                isCancelled: false,
                boardingStatus: 'pending_boarding',
                boardingLabel: 'Ожидает посадки',
                boardedAt: null,
                route: {
                    fromCity: 'Худжанд',
                    toCity: 'Нижневартовск',
                    fromAddress: 'г. Худжанд, Международный автовокзал «Рохи Абрешим»',
                    toAddress: 'г. Сургут / г. Нижневартовск (Автовокзал)',
                    pickupCity: 'Худжанд',
                    dropOffCity: 'Нижневартовск',
                    departureDate: '2026-09-01',
                    departureTime: '08:30',
                    arrivalDate: '2026-09-03',
                    arrivalTime: '18:00',
                    durationMinutes: 3450,
                    intermediateStops: [{ city: 'Сургут' }]
                },
                passenger: {
                    primaryName: 'Тестовый пассажир',
                    passengerCount: 1,
                    seats: [25],
                    seatNumbersDisplay: '25',
                    items: [
                        {
                            index: 1,
                            seat: 25,
                            name: 'Тестовый пассажир'
                        }
                    ]
                },
                bus: {
                    id: 42,
                    brand: 'Setra',
                    model: 'S431DT',
                    license_plate: '5051ZA20',
                    bus_type: 'double',
                    total_seats: 78,
                    floor1_seats: 20,
                    floor2_seats: 58,
                    amenities: ['wifi', 'usb', 'power_220v', 'wc', 'ac', 'luggage']
                },
                payment: {
                    currency: 'сомони',
                    currencyShort: 'сом',
                    totalPrice: 700,
                    paidAmount: 70,
                    remainingAmount: 630,
                    isManual: false,
                    paymentChannel: 'web'
                },
                carrier: {
                    companyName: 'ООО «Рохи Абрешим»',
                    operatorPhone: '+992 (92) 792 50 51'
                }
            }
        };
    }
};
</script>

<template>
    <div class="min-h-screen bg-slate-200 py-8 px-4 flex flex-col items-center justify-center">
        <div class="w-full max-w-4xl">
            <PassengerTicket 
                :ticket="mockTicket" 
                mode="screen"
                :showControls="true"
            />
        </div>
    </div>
</template>
