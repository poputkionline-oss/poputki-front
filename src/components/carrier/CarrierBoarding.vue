<script>
import api from '../../api';

export default {
    name: 'CarrierBoarding',
    props: {
        tickets: {
            type: Array,
            default: () => []
        },
        bookings: {
            type: Array,
            default: () => []
        },
        loading: {
            type: Boolean,
            default: false
        }
    },
    emits: ['refresh'],
    data() {
        return {
            selectedTicketId: null,
            statusFilter: 'all', // 'all' | 'pending_boarding' | 'boarded' | 'no_show'
            searchQuery: '',
            updatingBookings: {}, // Map of bookingId -> boolean
            toast: {
                show: false,
                message: '',
                type: 'success'
            }
        };
    },
    computed: {
        selectedTicket() {
            if (!this.selectedTicketId) return null;
            return this.tickets.find(t => t.id === Number(this.selectedTicketId)) || null;
        },
        sortedTickets() {
            const todayStr = new Date().toISOString().split('T')[0];
            return [...this.tickets].sort((a, b) => {
                const aIsToday = a.departure_date === todayStr ? 1 : 0;
                const bIsToday = b.departure_date === todayStr ? 1 : 0;
                if (aIsToday !== bIsToday) return bIsToday - aIsToday;
                return (b.departure_date || '').localeCompare(a.departure_date || '');
            });
        },
        ticketPassengers() {
            if (!this.selectedTicketId) return [];

            const passengers = [];
            const ticketBookings = this.bookings.filter(b => b.bus_ticket_id === Number(this.selectedTicketId));

            ticketBookings.forEach(b => {
                const pData = b.passengers_data || [];
                const bStatus = b.boarding_status || 'pending_boarding';

                if (pData.length === 0) {
                    const seatNum = (b.seat_numbers && b.seat_numbers[0]) ? b.seat_numbers[0] : 0;
                    passengers.push({
                        bookingId: b.id,
                        passengerIndex: 0,
                        name: b.passenger_name || 'Пассажир',
                        docType: '—',
                        docNumber: '—',
                        gender: '—',
                        phone: b.passenger_phone || b.phone || '',
                        pickupCity: b.pickup_city || this.selectedTicket?.from_city || '—',
                        dropOffCity: b.drop_off_city || this.selectedTicket?.to_city || '—',
                        seat: seatNum,
                        seatInt: Number(seatNum) || 999,
                        boardingStatus: bStatus,
                        boardedAt: b.boarded_at,
                        totalSeatsCount: (b.seat_numbers || []).length
                    });
                } else {
                    pData.forEach((p, idx) => {
                        const assignedSeat = (b.seat_numbers && b.seat_numbers[idx] !== undefined)
                            ? b.seat_numbers[idx]
                            : (p.seatNumber || p.seat || 0);

                        const fullName = [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ').trim() || b.passenger_name || 'Пассажир';
                        const pPhone = p.phone || b.passenger_phone || b.phone || '';

                        passengers.push({
                            bookingId: b.id,
                            passengerIndex: idx,
                            name: fullName,
                            docType: p.docType || 'Загранпаспорт',
                            docNumber: p.docNumber || '—',
                            gender: p.gender || '—',
                            phone: pPhone,
                            pickupCity: b.pickup_city || this.selectedTicket?.from_city || '—',
                            dropOffCity: b.drop_off_city || this.selectedTicket?.to_city || '—',
                            seat: assignedSeat,
                            seatInt: Number(assignedSeat) || 999,
                            boardingStatus: bStatus,
                            boardedAt: b.boarded_at,
                            totalSeatsCount: pData.length
                        });
                    });
                }
            });

            // Numerical sorting by seat number (1, 2, 3... 10, 11)
            return passengers.sort((a, b) => a.seatInt - b.seatInt);
        },
        counts() {
            const all = this.ticketPassengers;
            return {
                total: all.length,
                pending: all.filter(p => p.boardingStatus === 'pending_boarding').length,
                boarded: all.filter(p => p.boardingStatus === 'boarded').length,
                noShow: all.filter(p => p.boardingStatus === 'no_show').length
            };
        },
        filteredPassengers() {
            let list = this.ticketPassengers;

            // Filter by status
            if (this.statusFilter !== 'all') {
                list = list.filter(p => p.boardingStatus === this.statusFilter);
            }

            // Filter by search
            if (this.searchQuery.trim()) {
                const q = this.searchQuery.toLowerCase().trim();
                list = list.filter(p => {
                    return (
                        p.name.toLowerCase().includes(q) ||
                        p.phone.toLowerCase().includes(q) ||
                        String(p.seat).toLowerCase().includes(q) ||
                        p.pickupCity.toLowerCase().includes(q) ||
                        p.dropOffCity.toLowerCase().includes(q)
                    );
                });
            }

            return list;
        }
    },
    watch: {
        tickets: {
            immediate: true,
            handler(newTickets) {
                if (newTickets && newTickets.length > 0 && !this.selectedTicketId) {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const todayTicket = newTickets.find(t => t.departure_date === todayStr);
                    this.selectedTicketId = todayTicket ? todayTicket.id : newTickets[0].id;
                }
            }
        }
    },
    methods: {
        selectTicket(ticketId) {
            this.selectedTicketId = ticketId;
            this.searchQuery = '';
            this.statusFilter = 'all';
        },
        formatDate(dateStr) {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' });
        },
        formatTime(timeStr) {
            if (!timeStr) return '';
            return timeStr.substring(0, 5);
        },
        formatBoardedTime(isoStr) {
            if (!isoStr) return '';
            try {
                const d = new Date(isoStr);
                return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            } catch (e) {
                return '';
            }
        },
        isToday(dateStr) {
            const todayStr = new Date().toISOString().split('T')[0];
            return dateStr === todayStr;
        },
        cleanPhoneForWhatsApp(phone) {
            if (!phone) return '';
            return phone.replace(/\D/g, '');
        },
        getWhatsAppUrl(passenger) {
            const cleanPhone = this.cleanPhoneForWhatsApp(passenger.phone);
            if (!cleanPhone) return '#';
            const t = this.selectedTicket;
            const text = encodeURIComponent(
                `Здравствуйте, ${passenger.name}! Вас ожидает автобус ${t ? t.from_city + ' → ' + t.to_city : ''} (Место: ${passenger.seat}). Просим подойти на посадку.`
            );
            return `https://wa.me/${cleanPhone}?text=${text}`;
        },
        async updateBoardingStatus(passenger, newStatus) {
            const bookingId = passenger.bookingId;
            if (this.updatingBookings[bookingId]) return; // Double-click protection

            if (passenger.boardingStatus === newStatus) return;

            const oldStatus = passenger.boardingStatus;
            const oldBoardedAt = passenger.boardedAt;

            // 1. Optimistic UI update across all passenger cards belonging to this booking
            this.updatingBookings[bookingId] = true;
            this.ticketPassengers
                .filter(p => p.bookingId === bookingId)
                .forEach(p => {
                    p.boardingStatus = newStatus;
                    p.boardedAt = newStatus === 'boarded' ? new Date().toISOString() : null;
                });

            // Also update the parent bookings array to keep state in sync
            const parentBooking = this.bookings.find(b => b.id === bookingId);
            if (parentBooking) {
                parentBooking.boarding_status = newStatus;
                parentBooking.boarded_at = newStatus === 'boarded' ? new Date().toISOString() : null;
            }

            try {
                const res = await api.patch(`/bus-admin/bookings/${bookingId}/boarding`, {
                    boarding_status: newStatus
                });

                if (!res.data || !res.data.success) {
                    throw new Error(res.data?.error || 'Не удалось обновить статус');
                }

                // Show discreet success toast
                const statusLabels = {
                    boarded: 'Пассажир отмечен: Посажен',
                    no_show: 'Пассажир отмечен: Не явился',
                    pending_boarding: 'Статус сброшен: В ожидании'
                };
                this.showToast(statusLabels[newStatus] || 'Статус обновлен', 'success');
            } catch (err) {
                console.error('[CarrierBoarding] Status update failed:', err);

                // Rollback optimistic update
                this.ticketPassengers
                    .filter(p => p.bookingId === bookingId)
                    .forEach(p => {
                        p.boardingStatus = oldStatus;
                        p.boardedAt = oldBoardedAt;
                    });
                if (parentBooking) {
                    parentBooking.boarding_status = oldStatus;
                    parentBooking.boarded_at = oldBoardedAt;
                }

                this.showToast(err.response?.data?.error || 'Ошибка при обновлении статуса посадки', 'error');
            } finally {
                this.updatingBookings[bookingId] = false;
            }
        },
        showToast(msg, type = 'success') {
            this.toast = {
                show: true,
                message: msg,
                type: type
            };
            setTimeout(() => {
                this.toast.show = false;
            }, 3000);
        }
    }
};
</script>

<template>
    <div class="space-y-6">
        <!-- Toast Notification -->
        <transition enter-active-class="transition duration-200 ease-out" enter-from-class="transform translate-y-2 opacity-0" enter-to-class="transform translate-y-0 opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="transform translate-y-0 opacity-100" leave-to-class="transform translate-y-2 opacity-0">
            <div v-if="toast.show" :class="toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'" class="fixed bottom-6 right-6 z-50 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-semibold text-sm">
                <span>{{ toast.message }}</span>
            </div>
        </transition>

        <!-- STEP 1: TRIP SELECTOR -->
        <div class="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <span>🚌</span> Режим посадки пассажиров
                    </h2>
                    <p class="text-xs text-slate-500">Выберите рейс для контроля посадки возле автобуса</p>
                </div>
                <button @click="$emit('refresh')" class="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-600 active:scale-95 transition-all text-xs font-semibold flex items-center gap-1.5">
                    <span>↻</span> <span class="hidden sm:inline">Обновить</span>
                </button>
            </div>

            <!-- Horizontal Scrollable Trip Selector for Mobile & Desktop -->
            <div v-if="tickets.length === 0" class="py-6 text-center text-sm text-slate-400">
                Нет доступных рейсов
            </div>
            <div v-else class="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-slate-200">
                <button 
                    v-for="t in sortedTickets" 
                    :key="t.id"
                    @click="selectTicket(t.id)"
                    :class="selectedTicketId === t.id ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 border-amber-500' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-100'"
                    class="px-4 py-3 rounded-2xl border text-left shrink-0 transition-all active:scale-98 min-w-[200px]"
                >
                    <div class="flex items-center justify-between gap-2 mb-1">
                        <span class="text-xs font-extrabold uppercase tracking-wide">
                            {{ formatTime(t.departure_time) }}
                        </span>
                        <span v-if="isToday(t.departure_date)" :class="selectedTicketId === t.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'" class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                            Сегодня
                        </span>
                        <span v-else :class="selectedTicketId === t.id ? 'text-white/80' : 'text-slate-400'" class="text-[10px] font-bold">
                            {{ formatDate(t.departure_date) }}
                        </span>
                    </div>
                    <div class="font-bold text-sm truncate">
                        {{ t.from_city }} → {{ t.to_city }}
                    </div>
                    <div :class="selectedTicketId === t.id ? 'text-white/80' : 'text-slate-400'" class="text-[10px] truncate mt-0.5">
                        {{ t.transport_company || 'Рейсовый автобус' }}
                    </div>
                </button>
            </div>
        </div>

        <!-- IF TRIP SELECTED: BOARDING CONTROLS & PASSENGER MANIFEST -->
        <div v-if="selectedTicket" class="space-y-6">
            
            <!-- STEP 2: SUMMARY COUNTERS & FILTERS -->
            <div class="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                        <div class="text-xs font-black uppercase tracking-wider text-slate-400">Рейс #{{ selectedTicket.id }}</div>
                        <div class="text-lg font-bold text-slate-900">
                            {{ selectedTicket.from_city }} ({{ selectedTicket.from_address }}) → {{ selectedTicket.to_city }} ({{ selectedTicket.to_address }})
                        </div>
                    </div>
                    <div class="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 w-fit">
                        📅 {{ formatDate(selectedTicket.departure_date) }} в {{ formatTime(selectedTicket.departure_time) }}
                    </div>
                </div>

                <!-- Interactive Filter Counter Badges -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <!-- ALL -->
                    <button 
                        @click="statusFilter = 'all'"
                        :class="statusFilter === 'all' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'"
                        class="p-3.5 rounded-2xl text-left transition-all active:scale-98"
                    >
                        <div class="text-[10px] font-black uppercase tracking-wider opacity-70">Всего мест</div>
                        <div class="text-2xl font-black mt-0.5">{{ counts.total }}</div>
                    </button>

                    <!-- PENDING BOARDING -->
                    <button 
                        @click="statusFilter = 'pending_boarding'"
                        :class="statusFilter === 'pending_boarding' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25' : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200/60'"
                        class="p-3.5 rounded-2xl text-left transition-all active:scale-98"
                    >
                        <div class="text-[10px] font-black uppercase tracking-wider opacity-80">Ожидают</div>
                        <div class="text-2xl font-black mt-0.5">{{ counts.pending }}</div>
                    </button>

                    <!-- BOARDED -->
                    <button 
                        @click="statusFilter = 'boarded'"
                        :class="statusFilter === 'boarded' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25' : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200/60'"
                        class="p-3.5 rounded-2xl text-left transition-all active:scale-98"
                    >
                        <div class="text-[10px] font-black uppercase tracking-wider opacity-80">Посажены</div>
                        <div class="text-2xl font-black mt-0.5">{{ counts.boarded }}</div>
                    </button>

                    <!-- NO SHOW -->
                    <button 
                        @click="statusFilter = 'no_show'"
                        :class="statusFilter === 'no_show' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/25' : 'bg-rose-50 text-rose-900 hover:bg-rose-100 border border-rose-200/60'"
                        class="p-3.5 rounded-2xl text-left transition-all active:scale-98"
                    >
                        <div class="text-[10px] font-black uppercase tracking-wider opacity-80">Не явились</div>
                        <div class="text-2xl font-black mt-0.5">{{ counts.noShow }}</div>
                    </button>
                </div>

                <!-- Instant Search Bar -->
                <div class="relative">
                    <input 
                        v-model="searchQuery"
                        type="text"
                        placeholder="Поиск по месту, ФИО или телефону..."
                        class="w-full bg-slate-50 border border-slate-200/80 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 transition-all"
                    />
                    <span class="absolute left-3.5 top-3.5 text-slate-400 text-sm">🔍</span>
                    <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-xs bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center">
                        ✕
                    </button>
                </div>
            </div>

            <!-- STEP 3: PASSENGER CARDS (MOBILE-FIRST) -->
            <div v-if="filteredPassengers.length === 0" class="bg-white p-12 rounded-[28px] border border-slate-100 text-center space-y-2">
                <div class="text-3xl">👥</div>
                <div class="font-bold text-slate-700">Пассажиры не найдены</div>
                <p class="text-xs text-slate-400">
                    {{ searchQuery ? 'По вашему запросу ничего не найдено.' : 'На этот рейс пока нет зарегистрированных пассажиров.' }}
                </p>
            </div>

            <div v-else class="space-y-3">
                <div 
                    v-for="p in filteredPassengers" 
                    :key="`${p.bookingId}_${p.passengerIndex}`"
                    :class="{
                        'border-emerald-300 bg-emerald-50/30': p.boardingStatus === 'boarded',
                        'border-rose-300 bg-rose-50/30': p.boardingStatus === 'no_show',
                        'border-slate-100 bg-white': p.boardingStatus === 'pending_boarding'
                    }"
                    class="p-4 sm:p-5 rounded-[24px] border shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                    <!-- Left: Seat & Passenger Details -->
                    <div class="flex items-start gap-3.5 flex-1 min-w-0">
                        <!-- Prominent Seat Number Badge -->
                        <div 
                            :class="{
                                'bg-emerald-500 text-white': p.boardingStatus === 'boarded',
                                'bg-rose-500 text-white': p.boardingStatus === 'no_show',
                                'bg-amber-500 text-white': p.boardingStatus === 'pending_boarding'
                            }"
                            class="w-13 h-13 rounded-2xl flex flex-col items-center justify-center shrink-0 font-black shadow-sm"
                        >
                            <span class="text-[9px] uppercase tracking-tighter opacity-80 leading-none">Место</span>
                            <span class="text-xl leading-tight">{{ p.seat }}</span>
                        </div>

                        <!-- Info -->
                        <div class="min-w-0 flex-1 space-y-1">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-bold text-slate-900 text-base leading-snug truncate">
                                    {{ p.name }}
                                </span>
                                <!-- Status Badge for Desktop -->
                                <span 
                                    v-if="p.boardingStatus === 'boarded'"
                                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800"
                                >
                                    ✓ Посажен <span v-if="p.boardedAt" class="opacity-75">({{ formatBoardedTime(p.boardedAt) }})</span>
                                </span>
                                <span 
                                    v-else-if="p.boardingStatus === 'no_show'"
                                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800"
                                >
                                    ✕ Не явился
                                </span>
                                <span 
                                    v-else
                                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800"
                                >
                                    ⏳ В ожидании
                                </span>
                            </div>

                            <!-- Route details -->
                            <div class="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                                <span>📍 {{ p.pickupCity }} → {{ p.dropOffCity }}</span>
                                <span v-if="p.docNumber && p.docNumber !== '—'" class="text-slate-400">
                                    • {{ p.docType }}: {{ p.docNumber }}
                                </span>
                            </div>

                            <!-- Quick Contact Bar -->
                            <div v-if="p.phone" class="flex items-center gap-2 pt-1 flex-wrap">
                                <a 
                                    :href="`tel:${p.phone}`" 
                                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all active:scale-95"
                                >
                                    <span>📞</span>
                                    <span>{{ p.phone }}</span>
                                </a>
                                <a 
                                    :href="getWhatsAppUrl(p)" 
                                    target="_blank"
                                    class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-all active:scale-95"
                                >
                                    <span>💬</span>
                                    <span>WhatsApp</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Large Touch-friendly Status Action Buttons -->
                    <div class="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <!-- BOARDED BUTTON -->
                        <button 
                            @click="updateBoardingStatus(p, 'boarded')"
                            :disabled="updatingBookings[p.bookingId]"
                            :class="p.boardingStatus === 'boarded' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'"
                            class="flex-1 md:flex-initial px-4 py-3 rounded-2xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                        >
                            <span v-if="updatingBookings[p.bookingId] && p.boardingStatus !== 'boarded'" class="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                            <span>✓ Посажен</span>
                        </button>

                        <!-- NO SHOW BUTTON -->
                        <button 
                            @click="updateBoardingStatus(p, 'no_show')"
                            :disabled="updatingBookings[p.bookingId]"
                            :class="p.boardingStatus === 'no_show' ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700'"
                            class="flex-1 md:flex-initial px-4 py-3 rounded-2xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                        >
                            <span>✕ Не явился</span>
                        </button>

                        <!-- RESET TO PENDING -->
                        <button 
                            v-if="p.boardingStatus !== 'pending_boarding'"
                            @click="updateBoardingStatus(p, 'pending_boarding')"
                            :disabled="updatingBookings[p.bookingId]"
                            title="Сбросить в ожидание"
                            class="px-3 py-3 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 font-bold text-xs transition-all active:scale-95"
                        >
                            ↺
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
