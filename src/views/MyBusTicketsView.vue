<script>
import api from '../api';
import { openPhone, copyToClipboard } from '../telegram';
import AppToast from '../components/AppToast.vue';
import PassengerTicket from '../components/ticket/PassengerTicket.vue';

export default {
    name: 'MyBusTicketsView',
    components: {
        AppToast,
        PassengerTicket
    },
    data() {
        return {
            user: JSON.parse(localStorage.getItem('user') || 'null'),
            bookings: [],
            loading: true,
            showSuccessBanner: false,
            phoneExpandedBookings: new Set(),
            ticketModal: {
                show: false,
                data: null
            },
            toast: {
                show: false,
                message: '',
                type: 'success'
            }
        };
    },
    computed: {
        upcoming() {
            const now = new Date().toISOString().split('T')[0];
            return this.bookings.filter(b => b.departure_date >= now);
        },
        past() {
            const now = new Date().toISOString().split('T')[0];
            return this.bookings.filter(b => b.departure_date < now);
        }
    },
    methods: {
        async fetchBookings() {
            this.loading = true;
            try {
                const res = await api.get(`/users/${this.user.id}/bus-bookings`);
                this.bookings = res.data;
            } catch (e) {
                console.error(e);
            } finally {
                this.loading = false;
            }
        },
        formatDate(dateStr) {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        },
        formatDuration(minutes) {
            if (!minutes) return '';
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            return `${h} ч.${m > 0 ? ' ' + m + ' м.' : ''}`;
        },
        makeCall(phone, bookingId) {
            if (phone) {
                if (this.phoneExpandedBookings.has(bookingId)) {
                    this.phoneExpandedBookings.delete(bookingId);
                } else {
                    this.phoneExpandedBookings.add(bookingId);
                }
                openPhone(phone);
            }
        },
        async copyPhone(phone) {
            if (phone) {
                const success = await copyToClipboard(phone);
                if (success) {
                    this.toast.message = 'Номер скопирован в буфер обмена';
                    this.toast.type = 'success';
                    this.toast.show = true;
                    setTimeout(() => { this.toast.show = false; }, 3000);
                }
            }
        },
        viewTicket(b) {
            if (!b) return;
            const seats = Array.isArray(b.seat_numbers) ? b.seat_numbers : (typeof b.seat_numbers === 'string' ? JSON.parse(b.seat_numbers || '[]') : []);
            const pData = Array.isArray(b.passengers_data) ? b.passengers_data : (typeof b.passengers_data === 'string' ? JSON.parse(b.passengers_data || '[]') : []);
            const totalPrice = Number(b.total_price || 0);
            const isManual = b.channel === 'manual' || b.source_type === 'manual';
            const commAmount = Number(b.commission_amount ?? (isManual ? 0 : Math.round(totalPrice * 0.1)));
            const remainingAmount = Math.max(0, totalPrice - commAmount);
            const ticketNumber = `POP-${String(b.id).padStart(6, '0')}`;

            this.ticketModal.data = {
                brand: 'POPUTKI.ONLINE',
                ticketNumber,
                bookingId: b.id,
                verificationToken: `${b.id}`,
                verificationUrl: `https://www.poputki.online/ticket/${b.id}`,
                status: b.status || 'confirmed',
                statusLabel: b.status === 'confirmed' ? 'Подтвержден' : (b.status === 'pending_payment' ? 'Ожидает оплаты' : 'Отменен'),
                isValid: b.status === 'confirmed',
                boardingStatus: b.boarding_status || 'pending_boarding',
                boardingLabel: b.boarding_status === 'boarded' ? 'Пассажир сел' : (b.boarding_status === 'no_show' ? 'Не явился' : 'Ожидает посадки'),
                route: {
                    fromCity: b.from_city,
                    toCity: b.to_city,
                    fromAddress: b.from_address,
                    toAddress: b.to_address,
                    pickupCity: b.pickup_city || b.from_city,
                    dropOffCity: b.drop_off_city || b.to_city,
                    departureDate: b.departure_date,
                    departureTime: b.departure_time ? b.departure_time.substring(0, 5) : '',
                    arrivalDate: b.arrival_date || b.departure_date,
                    arrivalTime: b.arrival_time ? b.arrival_time.substring(0, 5) : ''
                },
                passenger: {
                    primaryName: b.passenger_name || (pData[0] ? `${pData[0].lastName || ''} ${pData[0].firstName || ''}`.trim() : this.user?.name || 'Пассажир'),
                    passengerCount: seats.length || 1,
                    seats: seats,
                    seatNumbersDisplay: seats.join(', '),
                    items: pData.length > 0 ? pData.map((p, idx) => ({
                        index: idx + 1,
                        seat: seats[idx] || p.seatNumber || '—',
                        name: `${p.lastName || ''} ${p.firstName || ''} ${p.middleName || ''}`.trim() || 'Пассажир',
                        docType: p.docType || 'Документ',
                        docNumber: p.docNumber || '—'
                    })) : seats.map(s => ({ index: 1, seat: s, name: this.user?.name || 'Пассажир', docType: '—', docNumber: '—' }))
                },
                bus: {
                    brand: b.bus_type === 'double' ? 'Двухэтажный автобус' : 'Автобус',
                    model: b.bus_model || '',
                    bus_type: b.bus_type || 'single'
                },
                payment: {
                    currency: 'сомони',
                    currencyShort: 'сом',
                    totalPrice,
                    paidAmount: commAmount,
                    remainingAmount
                },
                carrier: {
                    companyName: b.transport_company || 'POPUTKI.ONLINE',
                    operatorPhone: b.operator_phone
                }
            };
            this.ticketModal.show = true;
        }
    },
    async mounted() {
        if (!this.user) { this.$router.push('/auth'); return; }
        if (this.$route.query.booked === 'true') {
            this.showSuccessBanner = true;
            setTimeout(() => { this.showSuccessBanner = false; }, 5000);
            this.$router.replace({ name: 'my-bus-tickets' });
        }
        await this.fetchBookings();
    }
};
</script>

<template>
    <div class="min-h-screen bg-slate-50 pb-10">
        <!-- Header -->
        <div class="bg-gradient-to-br from-blue-600 to-indigo-700 px-5 pt-12 pb-7 rounded-b-[32px] shadow-lg shadow-indigo-500/20 relative overflow-hidden">
            <div class="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <div class="flex items-center gap-4 relative z-10">
                <button @click="$router.back()"
                    class="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white active:scale-90 transition-transform shrink-0">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                    </svg>
                </button>
                <div>
                    <h1 class="text-xl font-bold text-white">Мои билеты</h1>
                    <p class="text-white/60 text-xs mt-0.5">Автобусные бронирования</p>
                </div>
            </div>
        </div>

        <!-- Success Banner -->
        <Transition name="slide-down">
            <div v-if="showSuccessBanner" class="mx-5 mt-4 bg-green-500 text-white px-5 py-4 rounded-2xl shadow-lg shadow-green-500/25 flex items-center gap-3">
                <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                    </svg>
                </div>
                <div>
                    <div class="font-bold text-sm">Билет оформлен!</div>
                    <div class="text-xs opacity-80 mt-0.5">Ваши места зарезервированы</div>
                </div>
            </div>
        </Transition>

        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-24">
            <div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>

        <!-- Empty State -->
        <div v-else-if="bookings.length === 0" class="flex flex-col items-center justify-center py-24 px-8 text-center">
            <div class="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center mb-5">
                <svg class="w-12 h-12 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="5" width="18" height="14" rx="2"/>
                    <path stroke-linecap="round" d="M3 11h18M7 19v2M17 19v2M3 8h18"/>
                </svg>
            </div>
            <h3 class="text-xl font-bold text-slate-700 mb-2">Нет билетов</h3>
            <p class="text-gray-400 text-sm mb-6">У вас ещё нет купленных автобусных билетов</p>
            <button @click="$router.push({ name: 'search', query: { tab: 'bus' } })"
                class="bg-blue-600 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
                Найти рейс
            </button>
        </div>

        <!-- Bookings list -->
        <div v-else class="px-5 py-5 space-y-6">

            <!-- Upcoming -->
            <div v-if="upcoming.length > 0">
                <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Предстоящие ({{ upcoming.length }})</h2>
                <div class="space-y-4">
                    <div v-for="b in upcoming" :key="b.id"
                        class="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden relative">

                        <!-- Ticket Content -->
                        <div class="bg-gradient-to-br from-blue-700 to-indigo-800 px-6 py-5 relative">
                            <!-- Subtle background pattern -->
                            <div class="absolute inset-0 opacity-10" style="background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, #fff 10px, #fff 11px);"></div>

                            <div class="flex items-center justify-between mb-4 relative z-10">
                                <div class="text-blue-200 text-xs font-bold uppercase tracking-widest shrink-0">{{ b.transport_company }}</div>
                                <div class="bg-white/20 backdrop-blur text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-white/20">
                                    Подтверждено
                                </div>
                            </div>

                            <div class="flex items-center justify-between relative z-10">
                                <div>
                                    <div class="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">{{ b.departure_time }}</div>
                                    <div class="text-3xl font-black text-white tracking-tight">{{ formatDate(b.departure_date) }}</div>
                                    <div class="text-blue-100 text-sm font-semibold mt-1">{{ b.from_city }}</div>
                                </div>
                                <div class="flex flex-col items-center gap-1.5 px-4 shrink-0">
                                    <div class="text-blue-200 text-[10px] font-bold uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-full">
                                        {{ formatDuration(b.duration_minutes) }}
                                    </div>
                                    <div class="flex items-center gap-1 w-full mt-1 line-container relative">
                                        <div class="flex-1 border-t-2 border-dashed border-blue-300"></div>
                                        <svg class="w-5 h-5 text-blue-300 absolute left-1/2 -translate-x-1/2 -top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">{{ b.arrival_time }}</div>
                                    <div class="text-3xl font-black text-white tracking-tight">{{ formatDate(b.arrival_date || b.departure_date) }}</div>
                                    <div class="text-blue-100 text-sm font-semibold mt-1">{{ b.to_city }}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Ticket specifics -->
                        <div class="px-6 py-5 bg-white relative">
                            <div class="flex items-start justify-between">
                                <div class="space-y-4">
                                    <div>
                                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Пассажиры</div>
                                        <div class="font-bold text-slate-800 text-sm">{{ b.passenger_count }} {{ b.passenger_count === 1 ? 'пассажир' : 'пассажира' }}</div>
                                    </div>
                                    <div>
                                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Дата и время</div>
                                        <div class="font-bold text-slate-800 text-sm">{{ formatDate(b.departure_date) }}</div>
                                    </div>
                                </div>

                                <div class="text-right space-y-4">
                                     <div>
                                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Места</div>
                                        <div class="flex gap-1 justify-end flex-wrap max-w-[100px]">
                                            <span v-for="seat in b.seat_numbers" :key="seat" class="px-2 py-0.5 bg-gray-100 text-slate-700 text-xs font-bold rounded">
                                                №{{ seat }}
                                            </span>
                                        </div>
                                    </div>
                                     <div v-if="b.operator_phone" class="space-y-4">
                                        <a href="#" @click.prevent.stop="makeCall(b.operator_phone, b.id)" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-xl font-bold text-xs ring-1 ring-green-100 active:scale-95 transition-all" :class="{'ring-2 ring-green-500 ring-offset-1': phoneExpandedBookings.has(b.id)}">
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                            Позвонить
                                        </a>

                                        <Transition name="expand">
                                            <div v-if="phoneExpandedBookings.has(b.id)" @click.stop="copyPhone(b.operator_phone)" class="p-2 bg-slate-900 text-white rounded-xl flex items-center justify-between group cursor-pointer active:scale-95 transition-all shadow-lg border border-white/10 mt-2">
                                                <div class="flex items-center space-x-2">
                                                    <div class="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center">
                                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                    </div>
                                                    <span class="font-bold tracking-tight text-[10px]">{{ b.operator_phone }}</span>
                                                </div>
                                                <div class="p-1 bg-white/10 rounded-md">
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                                </div>
                                            </div>
                                        </Transition>
                                    </div>
                                    <div>
                                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Сумма</div>
                                        <div class="font-black text-slate-800 text-lg">{{ b.total_price }} с.</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Perforated Cutout Line -->
                        <div class="relative w-full h-8 flex items-center bg-white">
                            <div class="absolute -left-4 w-8 h-8 rounded-full bg-slate-50 border border-gray-100 z-10 shadow-inner"></div>
                            <div class="w-full border-t-[2px] border-dashed border-gray-200"></div>
                            <div class="absolute -right-4 w-8 h-8 rounded-full bg-slate-50 border border-gray-100 z-10 shadow-inner"></div>
                        </div>

                        <!-- Ticket Footer (QR Code & ID) -->
                        <div class="px-6 pb-4 pt-2 bg-white flex items-center justify-between">
                            <div>
                                <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Номер билета</div>
                                <div class="text-sm font-mono font-bold text-slate-800">
                                    TK-{{ String(b.id || Math.floor(Math.random() * 1000)).padStart(6, '0') }}-{{ new Date(b.departure_date).getMonth() + 1 }}
                                </div>
                            </div>

                            <!-- Fake Barcode Element to look like a ticket -->
                            <div class="flex items-center h-10 gap-[2px] opacity-80 mix-blend-multiply">
                                <div class="w-1 h-full bg-slate-800"></div>
                                <div class="w-0.5 h-full bg-slate-800"></div>
                                <div class="w-1.5 h-full bg-slate-800"></div>
                                <div class="w-1 h-full bg-slate-800"></div>
                                <div class="w-0.5 h-full bg-slate-800"></div>
                                <div class="w-2 h-full bg-slate-800"></div>
                                <div class="w-1 h-full bg-slate-800"></div>
                                <div class="w-[3px] h-full bg-slate-800"></div>
                                <div class="w-0.5 h-full bg-slate-800"></div>
                                <div class="w-1.5 h-full bg-slate-800"></div>
                                <div class="w-1 h-full bg-slate-800"></div>
                                <div class="w-[3px] h-full bg-slate-800"></div>
                                <div class="w-1 h-full bg-slate-800"></div>
                            </div>
                        </div>

                        <!-- Ticket Action Button -->
                        <div class="px-6 pb-6 bg-white">
                            <button
                                @click="viewTicket(b)"
                                class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow-md"
                            >
                                <span>🎫</span> <span>Электронный билет / Печать</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Past -->
            <div v-if="past.length > 0">
                <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Прошедшие ({{ past.length }})</h2>
                <div class="space-y-4">
                    <div v-for="b in past" :key="b.id"
                        class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden opacity-70">
                        <div class="bg-gradient-to-r from-slate-400 to-slate-500 px-5 py-4">
                            <div class="flex items-center justify-between mb-3">
                                <div class="text-white/60 text-xs font-bold uppercase tracking-wider">{{ b.transport_company }}</div>
                                <div class="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">Завершено</div>
                            </div>
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-2xl font-bold text-white">{{ b.departure_time }}</div>
                                    <div class="text-white/80 text-sm font-medium">{{ b.from_city }}</div>
                                </div>
                                <div class="text-white/40 text-xs px-3">→</div>
                                <div class="text-right">
                                    <div class="text-2xl font-bold text-white">{{ b.arrival_time }}</div>
                                    <div class="text-white/80 text-sm font-medium">{{ b.to_city }}</div>
                                </div>
                            </div>
                        </div>
                        <div class="px-5 py-3 flex items-center justify-between text-sm">
                            <div class="text-gray-400">{{ formatDate(b.departure_date) }}</div>
                            <button @click="viewTicket(b)" class="text-xs font-bold text-slate-700 hover:text-amber-600">
                                🎫 Билет
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- TICKET MODAL PREVIEW -->
        <div v-if="ticketModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <div class="w-full max-w-2xl bg-slate-100 rounded-[32px] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div v-if="ticketModal.data">
                    <PassengerTicket
                        :ticket="ticketModal.data"
                        mode="screen"
                        :showControls="true"
                        @close="ticketModal.show = false"
                    />
                </div>
            </div>
        </div>

        <AppToast :show="toast.show" :message="toast.message" :type="toast.type" />
    </div>
</template>

<style scoped>
.expand-enter-active, .expand-leave-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    max-height: 100px;
    opacity: 1;
    overflow: hidden;
}
.expand-enter-from, .expand-leave-to {
    max-height: 0;
    opacity: 0;
    transform: translateY(-10px);
}

.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-12px); }
</style>
