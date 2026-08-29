<script>
import api from '../../api';
import { exportPassengerManifestExcel, sortPassengersBySeat } from '../../utils/excelExport';
import PassengerTicket from '../ticket/PassengerTicket.vue';

export default {
    name: 'CarrierTripBookings',
    components: {
        PassengerTicket
    },
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
        },
        user: {
            type: Object,
            default: null
        }
    },
    emits: ['refresh', 'edit-booking', 'delete-booking'],
    data() {
        return {
            selectedTicketId: null,
            sourceFilter: 'all', // 'all' | 'online' | 'manual'
            paymentFilter: 'all', // 'all' | 'confirmed' | 'pending_payment'
            boardingFilter: 'all', // 'all' | 'pending_boarding' | 'boarded' | 'no_show'
            searchQuery: '',
            summary: null,
            summaryLoading: false,
            expandedBookingIds: {},
            ticketModal: {
                show: false,
                loading: false,
                data: null
            },
            bulkPrintModal: {
                show: false,
                loading: false,
                tripInfo: null,
                manifest: []
            },
            toast: {
                show: false,
                message: '',
                type: 'success'
            }
        };
    },
    computed: {
        isDriver() {
            return this.user?.role === 'driver';
        },
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

            const manifest = [];
            const ticketBookings = this.bookings.filter(b => b.bus_ticket_id === Number(this.selectedTicketId));

            ticketBookings.forEach(b => {
                const pData = b.passengers_data || [];
                const isManual = b.channel === 'manual' || b.source_type === 'manual' || b.source_type === 'carrier';
                const totalPrice = Number(b.total_price || 0);
                const commAmount = Number(b.commission_amount ?? (isManual ? 0 : Math.round(totalPrice * 0.1)));
                const carrierAmount = Number(b.carrier_amount ?? Math.max(0, totalPrice - commAmount));

                let paymentLabel = 'Подтверждено';
                if (b.status === 'pending_payment') {
                    paymentLabel = 'Ожидает оплаты';
                } else if (b.status === 'cancelled') {
                    paymentLabel = 'Отменено';
                } else if (isManual || totalPrice === 0) {
                    paymentLabel = 'Ручная бронь';
                }

                let sourceLabel = 'Онлайн: Web';
                if (b.channel === 'telegram') sourceLabel = 'Онлайн: Telegram';
                else if (isManual) sourceLabel = 'Ручная бронь';
                else if (b.source_type === 'carrier_link') sourceLabel = 'Ссылка перевозчика';
                else if (b.source_type === 'partner_link') sourceLabel = 'Партнерская ссылка';
                else if (!b.channel && !b.source_type) sourceLabel = 'UNKNOWN / LEGACY';
                else if (b.source_type && b.source_type !== 'platform') sourceLabel = `Источник: ${b.source_type}`;

                if (pData.length === 0) {
                    const seatVal = (b.seat_numbers && b.seat_numbers[0]) ? b.seat_numbers[0] : '—';
                    manifest.push({
                        bookingId: b.id,
                        passengerIndex: 0,
                        name: b.passenger_name || '—',
                        lastName: b.passenger_name || '—',
                        firstName: '',
                        middleName: '',
                        seat: seatVal,
                        seatInt: Number(seatVal) || 999,
                        gender: '—',
                        birthDate: '—',
                        docType: '—',
                        docNumber: '—',
                        citizenship: '—',
                        phone: b.passenger_phone || b.phone || '',
                        pickupCity: b.pickup_city || this.selectedTicket?.from_city || '—',
                        dropOffCity: b.drop_off_city || this.selectedTicket?.to_city || '—',
                        totalPrice: this.isDriver ? null : totalPrice,
                        commissionAmount: this.isDriver ? null : commAmount,
                        carrierAmount: this.isDriver ? null : carrierAmount,
                        commissionRate: this.isDriver ? null : (b.commission_rate || (isManual ? 0 : 10)),
                        channel: b.channel || 'web',
                        sourceType: b.source_type || 'platform',
                        sourceLabel: sourceLabel,
                        isManual: isManual,
                        status: b.status || 'confirmed',
                        paymentStatus: paymentLabel,
                        boardingStatus: b.boarding_status || 'pending_boarding',
                        boardedAt: b.boarded_at,
                        createdAt: b.created_at,
                        originalBooking: b
                    });
                } else {
                    const pCount = pData.length;
                    const singlePrice = Math.round(totalPrice / Math.max(1, pCount));
                    const singleComm = Math.round(commAmount / Math.max(1, pCount));
                    const singleCarrier = Math.round(carrierAmount / Math.max(1, pCount));

                    pData.forEach((p, idx) => {
                        const assignedSeat = (b.seat_numbers && b.seat_numbers[idx] !== undefined)
                            ? b.seat_numbers[idx]
                            : (p.seatNumber || p.seat || '—');

                        const fullName = [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ').trim() || b.passenger_name || '—';
                        const pPhone = p.phone || b.passenger_phone || b.phone || '';

                        manifest.push({
                            bookingId: b.id,
                            passengerIndex: idx,
                            name: fullName,
                            lastName: p.lastName || '',
                            firstName: p.firstName || '',
                            middleName: p.middleName || '',
                            seat: assignedSeat,
                            seatInt: Number(assignedSeat) || 999,
                            gender: p.gender === 'male' ? 'Муж' : (p.gender === 'female' ? 'Жен' : '—'),
                            birthDate: p.birthDate || '—',
                            docType: p.docType || 'Загранпаспорт',
                            docNumber: p.docNumber || '—',
                            citizenship: p.citizenship || '—',
                            phone: pPhone,
                            pickupCity: b.pickup_city || this.selectedTicket?.from_city || '—',
                            dropOffCity: b.drop_off_city || this.selectedTicket?.to_city || '—',
                            totalPrice: this.isDriver ? null : singlePrice,
                            commissionAmount: this.isDriver ? null : singleComm,
                            carrierAmount: this.isDriver ? null : singleCarrier,
                            commissionRate: this.isDriver ? null : (b.commission_rate || (isManual ? 0 : 10)),
                            channel: b.channel || 'web',
                            sourceType: b.source_type || 'platform',
                            sourceLabel: sourceLabel,
                            isManual: isManual,
                            status: b.status || 'confirmed',
                            paymentStatus: paymentLabel,
                            boardingStatus: b.boarding_status || 'pending_boarding',
                            boardedAt: b.boarded_at,
                            createdAt: b.created_at,
                            originalBooking: b
                        });
                    });
                }
            });

            return manifest.sort((a, b) => a.seatInt - b.seatInt);
        },
        statusCounts() {
            const all = this.ticketPassengers;
            return {
                all: all.length,
                confirmed: all.filter(p => p.status === 'confirmed').length,
                pending_payment: all.filter(p => p.status === 'pending_payment').length,
                cancelled: all.filter(p => p.status === 'cancelled').length
            };
        },
        boardingCounts() {
            const confirmed = this.ticketPassengers.filter(p => p.status === 'confirmed');
            return {
                all: confirmed.length,
                boarded: confirmed.filter(p => p.boardingStatus === 'boarded').length,
                pending_boarding: confirmed.filter(p => p.boardingStatus === 'pending_boarding').length,
                no_show: confirmed.filter(p => p.boardingStatus === 'no_show').length
            };
        },
        filteredPassengers() {
            let list = this.ticketPassengers;

            // Source filter
            if (this.sourceFilter === 'online') {
                list = list.filter(p => !p.isManual);
            } else if (this.sourceFilter === 'manual') {
                list = list.filter(p => p.isManual);
            }

            // Primary Payment / Business Status filter
            if (this.paymentFilter === 'confirmed') {
                list = list.filter(p => p.status === 'confirmed');
            } else if (this.paymentFilter === 'pending_payment') {
                list = list.filter(p => p.status === 'pending_payment');
            } else if (this.paymentFilter === 'cancelled') {
                list = list.filter(p => p.status === 'cancelled');
            }

            // Secondary Boarding filter (active only for confirmed bookings)
            if (this.boardingFilter !== 'all' && this.paymentFilter !== 'pending_payment' && this.paymentFilter !== 'cancelled') {
                list = list.filter(p => p.status === 'confirmed' && p.boardingStatus === this.boardingFilter);
            }


            // Search query
            if (this.searchQuery.trim()) {
                const q = this.searchQuery.toLowerCase().trim();
                list = list.filter(p => {
                    return (
                        p.name.toLowerCase().includes(q) ||
                        p.phone.toLowerCase().includes(q) ||
                        String(p.seat).toLowerCase().includes(q) ||
                        p.docNumber.toLowerCase().includes(q) ||
                        p.pickupCity.toLowerCase().includes(q) ||
                        p.dropOffCity.toLowerCase().includes(q)
                    );
                });
            }

            return list;
        },
        sourceCounts() {
            const all = this.ticketPassengers;
            return {
                all: all.length,
                online: all.filter(p => !p.isManual).length,
                manual: all.filter(p => p.isManual).length
            };
        }

    },
    watch: {
        tickets: {
            immediate: true,
            handler(newTickets) {
                if (newTickets && newTickets.length > 0 && !this.selectedTicketId) {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const todayTicket = newTickets.find(t => t.departure_date === todayStr);
                    this.selectTicket(todayTicket ? todayTicket.id : newTickets[0].id);
                }
            }
        },
        selectedTicketId(newId) {
            if (newId) {
                this.fetchTripSummary(newId);
            }
        }
    },
    methods: {
        selectTicket(ticketId) {
            this.selectedTicketId = ticketId;
            this.sourceFilter = 'all';
            this.paymentFilter = 'all';
            this.boardingFilter = 'all';
            this.searchQuery = '';
            this.fetchTripSummary(ticketId);
        },
        async fetchTripSummary(ticketId) {
            if (!ticketId) return;
            this.summaryLoading = true;
            try {
                const res = await api.get(`/bus-admin/tickets/${ticketId}/summary`);
                this.summary = res.data;
            } catch (err) {
                console.error('[CarrierTripBookings] Error fetching summary:', err);
                this.summary = null;
            } finally {
                this.summaryLoading = false;
            }
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
        isToday(dateStr) {
            const todayStr = new Date().toISOString().split('T')[0];
            return dateStr === todayStr;
        },
        toggleCard(bookingId) {
            this.expandedBookingIds[bookingId] = !this.expandedBookingIds[bookingId];
        },
        cleanPhone(phone) {
            return (phone || '').replace(/\D/g, '');
        },
        getWhatsAppUrl(passenger) {
            const p = this.cleanPhone(passenger.phone);
            if (!p) return '#';
            const t = this.selectedTicket;
            const text = encodeURIComponent(
                `Здравствуйте, ${passenger.name}! Напоминаем о вашей поездке на автобусе ${t ? t.from_city + ' → ' + t.to_city : ''} (Место: ${passenger.seat}).`
            );
            return `https://wa.me/${p}?text=${text}`;
        },
        async exportExcel() {
            if (!this.ticketPassengers || this.ticketPassengers.length === 0) return;
            const manifestForExport = this.ticketPassengers.map(p => ({
                lastName: p.lastName || p.name,
                firstName: p.firstName,
                middleName: p.middleName,
                seat: p.seat,
                gender: p.gender,
                birthDate: p.birthDate,
                docType: p.docType,
                docNumber: p.docNumber,
                citizenship: p.citizenship,
                contactPhone: p.phone,
                pickup_city: p.pickupCity,
                drop_off_city: p.dropOffCity,
                paymentStatus: p.paymentStatus,
                originalBookingId: p.bookingId,
                createdAt: p.createdAt
            }));
            await exportPassengerManifestExcel(this.selectedTicket, sortPassengersBySeat(manifestForExport), this.user);
        },
        async openTicketPreview(bookingId) {
            if (!bookingId) return;
            this.ticketModal.loading = true;
            this.ticketModal.show = true;
            this.ticketModal.data = null;
            try {
                const res = await api.get(`/bus-admin/bookings/${bookingId}/ticket`);
                this.ticketModal.data = res.data;
            } catch (err) {
                console.error('Error fetching ticket preview:', err);
                this.toast.message = err.response?.data?.error || 'Ошибка загрузки билета';
                this.toast.type = 'error';
                this.toast.show = true;
                setTimeout(() => { this.toast.show = false; }, 3000);
                this.ticketModal.show = false;
            } finally {
                this.ticketModal.loading = false;
            }
        },
        async openBulkPrint(ticketId) {
            if (!ticketId) return;
            this.bulkPrintModal.loading = true;
            this.bulkPrintModal.show = true;
            this.bulkPrintModal.manifest = [];
            this.bulkPrintModal.tripInfo = null;
            try {
                const res = await api.get(`/bus-admin/tickets/${ticketId}/print-manifest`);
                this.bulkPrintModal.manifest = res.data.tickets || [];
                this.bulkPrintModal.tripInfo = res.data;
            } catch (err) {
                console.error('Error fetching bulk print manifest:', err);
                this.toast.message = err.response?.data?.error || 'Ошибка формирования билетов рейса';
                this.toast.type = 'error';
                this.toast.show = true;
                setTimeout(() => { this.toast.show = false; }, 3000);
                this.bulkPrintModal.show = false;
            } finally {
                this.bulkPrintModal.loading = false;
            }
        },
        triggerBulkPrint() {
            window.print();
        }
    }
};
</script>

<template>
    <div class="space-y-6">
        <!-- STEP 1: TRIP SELECTOR -->
        <div class="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <span>📋</span> Управление бронированиями и финансы рейса
                    </h2>
                    <p class="text-xs text-slate-500">Выберите рейс для просмотра полного списка пассажиров и финансовой сводки</p>
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                    <button
                        @click="openBulkPrint(selectedTicketId)"
                        :disabled="!selectedTicket || statusCounts.confirmed === 0"
                        class="px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40 shadow-sm"
                        title="Распечатать все билеты подтвержденных пассажиров"
                    >
                        <span>🖨</span> <span>Распечатать билеты</span>
                    </button>
                    <button
                        @click="exportExcel"
                        :disabled="!selectedTicket || ticketPassengers.length === 0"
                        class="px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 font-bold text-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40"
                    >
                        <span>📊</span> <span>Экспорт в Excel</span>
                    </button>
                    <button @click="$emit('refresh')" class="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-600 active:scale-95 transition-all text-xs font-semibold">
                        <span>↻</span>
                    </button>
                </div>
            </div>

            <!-- Horizontal Scrollable Selector -->
            <div v-if="tickets.length === 0" class="py-6 text-center text-sm text-slate-400">
                Нет созданных рейсов
            </div>
            <div v-else class="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-slate-200">
                <button
                    v-for="t in sortedTickets"
                    :key="t.id"
                    @click="selectTicket(t.id)"
                    :class="selectedTicketId === t.id ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 border-slate-900' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-100'"
                    class="px-4 py-3 rounded-2xl border text-left shrink-0 transition-all active:scale-98 min-w-[210px]"
                >
                    <div class="flex items-center justify-between gap-2 mb-1">
                        <span class="text-xs font-extrabold uppercase tracking-wide">
                            {{ formatTime(t.departure_time) }}
                        </span>
                        <span v-if="isToday(t.departure_date)" :class="selectedTicketId === t.id ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800'" class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                            Сегодня
                        </span>
                        <span v-else :class="selectedTicketId === t.id ? 'text-white/70' : 'text-slate-400'" class="text-[10px] font-bold">
                            {{ formatDate(t.departure_date) }}
                        </span>
                    </div>
                    <div class="font-bold text-sm truncate">
                        {{ t.from_city }} → {{ t.to_city }}
                    </div>
                    <div :class="selectedTicketId === t.id ? 'text-white/70' : 'text-slate-400'" class="text-[10px] truncate mt-0.5 flex items-center justify-between">
                        <span>{{ t.price }} сомони</span>
                        <span>{{ t.total_seats }} мест</span>
                    </div>
                </button>
            </div>
        </div>

        <!-- TRIP ACTIVE: FINANCIAL & OPERATIONAL SUMMARY WIDGET -->
        <div v-if="selectedTicket" class="space-y-6">

            <!-- Summary Header Banner -->
            <div class="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-[32px] shadow-xl relative overflow-hidden space-y-6">
                <!-- Background Accent Glow -->
                <div class="absolute -right-20 -top-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 border-b border-white/10 pb-4">
                    <div>
                        <div class="text-xs font-black uppercase tracking-wider text-amber-400 mb-0.5">Финансовый отчет рейса #{{ selectedTicket.id }}</div>
                        <h3 class="text-xl sm:text-2xl font-bold">
                            {{ selectedTicket.from_city }} → {{ selectedTicket.to_city }}
                        </h3>
                        <p class="text-xs text-slate-400 mt-1">
                            📅 {{ formatDate(selectedTicket.departure_date) }} в {{ formatTime(selectedTicket.departure_time) }} • Тариф: {{ selectedTicket.price }} сомони
                        </p>
                    </div>
                    <!-- Quick Occupancy Gauge -->
                    <div class="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl w-fit">
                        <div class="text-right">
                            <div class="text-[10px] font-bold text-slate-400 uppercase">Загрузка рейса</div>
                            <div class="text-lg font-black text-amber-400">
                                {{ summary?.booked_seats || 0 }} / {{ summary?.capacity || selectedTicket.total_seats }} мест
                            </div>
                            <div v-if="summary?.held_seats > 0" class="text-[9px] text-amber-300 font-bold">
                                ({{ summary.confirmed_seats || 0 }} продано, {{ summary.held_seats }} ждут оплаты)
                            </div>
                        </div>
                        <div class="text-2xl">🚌</div>
                    </div>
                </div>

                <!-- Financial Metric Cards Grid -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
                    <!-- 1. GROSS REVENUE -->
                    <div v-if="!isDriver" class="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Продано билетов</div>
                        <div class="text-xl sm:text-2xl font-black text-white mt-1">
                            {{ summary?.paid_amount || 0 }} <span class="text-xs font-bold text-slate-400">сом</span>
                        </div>
                        <div class="text-[10px] text-slate-400 mt-1">
                            {{ summary?.online_bookings || 0 }} онлайн / {{ summary?.manual_bookings || 0 }} ручных
                        </div>
                    </div>

                    <!-- 2. SERVICE FEE (POPUTKI.ONLINE) -->
                    <div v-if="!isDriver" class="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                        <div class="text-[10px] font-bold uppercase tracking-wider text-amber-400">Сбор платформы (10%)</div>
                        <div class="text-xl sm:text-2xl font-black text-amber-400 mt-1">
                            {{ summary?.service_commission || 0 }} <span class="text-xs font-bold text-amber-400/70">сом</span>
                        </div>
                        <div class="text-[10px] text-slate-400 mt-1">
                            0% с ручных броней
                        </div>
                    </div>

                    <!-- 3. CARRIER NET PAYOUT -->
                    <div v-if="!isDriver" class="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                        <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-400">К выплате перевозчику</div>
                        <div class="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                            {{ summary?.carrier_amount || 0 }} <span class="text-xs font-bold text-emerald-400/70">сом</span>
                        </div>
                        <div class="text-[10px] text-emerald-400/80 mt-1">
                            Чистый доход перевозчика
                        </div>
                    </div>

                    <!-- 4. BOARDING STATS -->
                    <div :class="isDriver ? 'col-span-2 sm:col-span-4' : ''" class="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                        <div class="text-[10px] font-bold uppercase tracking-wider text-sky-400">Посадка пассажиров</div>
                        <div class="text-xl sm:text-2xl font-black text-white mt-1">
                            {{ summary?.boarding?.boarded || 0 }} <span class="text-xs font-bold text-slate-400">/ {{ summary?.boarding?.total_passengers || 0 }}</span>
                        </div>
                        <div class="text-[10px] text-slate-400 mt-1">
                            Ожидают: {{ summary?.boarding?.pending || 0 }} • No-show: {{ summary?.boarding?.no_show || 0 }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- STEP 2: FILTERS & SEARCH -->
            <div class="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm space-y-4">
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <!-- Filters Tabs Group -->
                    <div class="flex flex-wrap items-center gap-2">
                        <!-- PRIMARY STATUS / PAYMENT FILTER -->
                        <div class="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
                            <button
                                @click="paymentFilter = 'all'; boardingFilter = 'all'"
                                :class="paymentFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                                class="px-3 py-1.5 rounded-xl transition-all"
                            >
                                Все ({{ statusCounts.all }})
                            </button>
                            <button
                                @click="paymentFilter = 'confirmed'"
                                :class="paymentFilter === 'confirmed' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                                class="px-3 py-1.5 rounded-xl transition-all"
                            >
                                ✓ Подтверждены ({{ statusCounts.confirmed }})
                            </button>
                            <button
                                @click="paymentFilter = 'pending_payment'; boardingFilter = 'all'"
                                :class="paymentFilter === 'pending_payment' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-700 hover:bg-amber-50'"
                                class="px-3 py-1.5 rounded-xl transition-all font-black flex items-center gap-1"
                            >
                                <span>⏳ Ожидают оплаты</span>
                                <span v-if="statusCounts.pending_payment > 0" class="px-1.5 py-0.2 text-[10px] rounded-full" :class="paymentFilter === 'pending_payment' ? 'bg-white text-amber-900' : 'bg-amber-200 text-amber-900'">{{ statusCounts.pending_payment }}</span>
                            </button>
                            <button
                                @click="paymentFilter = 'cancelled'; boardingFilter = 'all'"
                                :class="paymentFilter === 'cancelled' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-700'"
                                class="px-3 py-1.5 rounded-xl transition-all"
                            >
                                Отменены ({{ statusCounts.cancelled }})
                            </button>
                        </div>

                        <!-- BOARDING SUB-FILTER (Active only for confirmed/all) -->
                        <div v-if="paymentFilter !== 'pending_payment' && paymentFilter !== 'cancelled'" class="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
                            <button
                                @click="boardingFilter = 'all'"
                                :class="boardingFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                                class="px-2.5 py-1.5 rounded-xl transition-all"
                            >
                                Посадка: Все
                            </button>
                            <button
                                @click="boardingFilter = 'boarded'"
                                :class="boardingFilter === 'boarded' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                                class="px-2.5 py-1.5 rounded-xl transition-all"
                            >
                                ✓ Сели ({{ boardingCounts.boarded }})
                            </button>
                            <button
                                @click="boardingFilter = 'pending_boarding'"
                                :class="boardingFilter === 'pending_boarding' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                                class="px-2.5 py-1.5 rounded-xl transition-all"
                            >
                                ⏳ Ждут ({{ boardingCounts.pending_boarding }})
                            </button>
                            <button
                                @click="boardingFilter = 'no_show'"
                                :class="boardingFilter === 'no_show' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                                class="px-2.5 py-1.5 rounded-xl transition-all"
                            >
                                ✕ No-show ({{ boardingCounts.no_show }})
                            </button>
                        </div>

                        <!-- SOURCE FILTER -->
                        <div class="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
                            <button
                                @click="sourceFilter = 'all'"
                                :class="sourceFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                                class="px-2.5 py-1.5 rounded-xl transition-all"
                            >
                                Все
                            </button>
                            <button
                                @click="sourceFilter = 'online'"
                                :class="sourceFilter === 'online' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                                class="px-2.5 py-1.5 rounded-xl transition-all"
                            >
                                Онлайн
                            </button>
                            <button
                                @click="sourceFilter = 'manual'"
                                :class="sourceFilter === 'manual' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                                class="px-2.5 py-1.5 rounded-xl transition-all"
                            >
                                Ручные
                            </button>
                        </div>
                    </div>

                    <!-- Search Box -->
                    <div class="relative w-full lg:w-72">
                        <input
                            v-model="searchQuery"
                            type="text"
                            placeholder="Поиск по ФИО, телефону, месту..."
                            class="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
                        />
                        <span class="absolute left-3.5 top-3 text-slate-400 text-xs">🔍</span>
                        <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center">
                            ✕
                        </button>
                    </div>
                </div>
            </div>

            <!-- STEP 3: UNIFIED PASSENGER MANIFEST & FINANCIAL LIST -->
            <div v-if="filteredPassengers.length === 0" class="bg-white p-12 rounded-[28px] border border-slate-100 text-center space-y-2">
                <div class="text-3xl">👥</div>
                <div class="font-bold text-slate-700">Бронирования не найдены</div>
                <p class="text-xs text-slate-400">
                    {{ searchQuery ? 'По вашему фильтру ничего не найдено.' : 'На этот рейс пока нет зарегистрированных пассажиров по выбранным критериям.' }}
                </p>
            </div>

            <div v-else class="space-y-4">

                <!-- DESKTOP TABLE VIEW (HIDDEN ON SMALL SCREENS) -->
                <div class="hidden lg:block bg-white rounded-[28px] border border-slate-100 overflow-hidden shadow-sm">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100">
                                    <th class="px-5 py-4">МЕСТО</th>
                                    <th class="px-5 py-4">ПАССАЖИР</th>
                                    <th class="px-5 py-4">КОНТАКТ</th>
                                    <th class="px-5 py-4">МАРШРУТ</th>
                                    <th class="px-5 py-4">ИСТОЧНИК</th>
                                    <th v-if="!isDriver" class="px-5 py-4">СТОИМОСТЬ</th>
                                    <th v-if="!isDriver" class="px-5 py-4">КОМИССИЯ (10%)</th>
                                    <th v-if="!isDriver" class="px-5 py-4">ПЕРЕВОЗЧИКУ</th>
                                    <th class="px-5 py-4">ОПЛАТА</th>
                                    <th class="px-5 py-4">ПОСАДКА</th>
                                    <th class="px-5 py-4 text-right">ДЕЙСТВИЯ</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-50 text-xs">
                                <tr v-for="(p, idx) in filteredPassengers" :key="`${p.bookingId}_${p.passengerIndex}`" class="hover:bg-slate-50/50 transition-colors">
                                    <!-- Seat -->
                                    <td class="px-5 py-4">
                                        <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-amber-50 text-amber-800 font-black text-xs border border-amber-200/60">
                                            {{ p.seat }}
                                        </span>
                                    </td>

                                    <!-- Passenger Name & Doc -->
                                    <td class="px-5 py-4">
                                        <div class="font-bold text-slate-900">{{ p.name }}</div>
                                        <div v-if="p.docNumber && p.docNumber !== '—'" class="text-[10px] text-slate-400 mt-0.5">
                                            {{ p.docType }}: {{ p.docNumber }}
                                        </div>
                                    </td>

                                    <!-- Phone & Quick Actions -->
                                    <td class="px-5 py-4">
                                        <div v-if="p.phone" class="flex items-center gap-1.5">
                                            <a :href="`tel:${p.phone}`" class="font-bold text-slate-700 hover:text-amber-600 transition-colors">
                                                {{ p.phone }}
                                            </a>
                                            <a :href="getWhatsAppUrl(p)" target="_blank" class="text-emerald-600 hover:text-emerald-700 text-xs font-bold" title="Написать в WhatsApp">
                                                💬
                                            </a>
                                        </div>
                                        <span v-else class="text-slate-400">—</span>
                                    </td>

                                    <!-- Route -->
                                    <td class="px-5 py-4">
                                        <div class="text-[11px] font-bold text-slate-700">{{ p.pickupCity }} → {{ p.dropOffCity }}</div>
                                    </td>

                                    <!-- Source -->
                                    <td class="px-5 py-4">
                                        <span
                                            :class="{
                                                'bg-blue-50 text-blue-700 border-blue-200/60': p.isManual,
                                                'bg-emerald-50 text-emerald-700 border-emerald-200/60': !p.isManual
                                            }"
                                            class="inline-block px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border"
                                        >
                                            {{ p.sourceLabel }}
                                        </span>
                                    </td>

                                    <!-- Price -->
                                    <td v-if="!isDriver" class="px-5 py-4 font-bold text-slate-900">
                                        <span v-if="p.isManual && p.totalPrice === 0" class="text-slate-400 text-[10px] italic">Legacy / Без снимка</span>
                                        <span v-else>{{ p.totalPrice }} сом</span>
                                    </td>

                                    <!-- Commission -->
                                    <td v-if="!isDriver" class="px-5 py-4 font-bold text-amber-600">
                                        {{ p.commissionAmount }} сом
                                    </td>

                                    <!-- Carrier Amount -->
                                    <td v-if="!isDriver" class="px-5 py-4 font-black text-emerald-600">
                                        <span v-if="p.isManual && p.carrierAmount === 0" class="text-slate-400 text-[10px] italic">Legacy / Без снимка</span>
                                        <span v-else>{{ p.carrierAmount }} сом</span>
                                    </td>

                                    <!-- Payment / Business Status -->
                                    <td class="px-5 py-4">
                                        <span
                                            v-if="p.status === 'pending_payment'"
                                            class="inline-block px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300"
                                        >
                                            ⏳ Ожидает оплаты
                                        </span>
                                        <span
                                            v-else-if="p.status === 'cancelled'"
                                            class="inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500"
                                        >
                                            ✕ Отменено
                                        </span>
                                        <span
                                            v-else
                                            class="inline-block px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200"
                                        >
                                            ✓ Подтверждено
                                        </span>
                                    </td>

                                    <!-- Boarding Status Badge -->
                                    <td class="px-5 py-4">
                                        <span v-if="p.status !== 'confirmed'" class="text-slate-300 font-bold px-2 py-1">
                                            —
                                        </span>
                                        <span
                                            v-else
                                            :class="{
                                                'bg-emerald-100 text-emerald-800': p.boardingStatus === 'boarded',
                                                'bg-rose-100 text-rose-800': p.boardingStatus === 'no_show',
                                                'bg-sky-50 text-sky-800 border border-sky-200': p.boardingStatus === 'pending_boarding'
                                            }"
                                            class="inline-block px-2.5 py-1 rounded-full text-[10px] font-black"
                                        >
                                            {{ p.boardingStatus === 'boarded' ? '✓ Посажен' : (p.boardingStatus === 'no_show' ? '✕ No-show' : '⏳ Ожидает посадки') }}
                                        </span>
                                    </td>

                                    <!-- Actions -->
                                    <td class="px-5 py-4 text-right">
                                        <div class="inline-flex items-center gap-2">
                                            <button
                                                @click="openTicketPreview(p.bookingId)"
                                                class="px-2.5 py-1 text-slate-700 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                                                title="Посмотреть и распечатать электронный билет"
                                            >
                                                <span>🎫</span>
                                                <span>Билет</span>
                                            </button>
                                            <button @click="$emit('edit-booking', p.bookingId)" class="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-slate-100 transition-colors" title="Редактировать">
                                                ✎
                                            </button>
                                            <button @click="$emit('delete-booking', p.bookingId)" class="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 transition-colors" title="Удалить">
                                                🗑
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- MOBILE CARDS VIEW (<= 390px / SMALL SCREENS) -->
                <div class="lg:hidden space-y-3">
                    <div
                        v-for="p in filteredPassengers"
                        :key="`m_${p.bookingId}_${p.passengerIndex}`"
                        class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex items-center gap-3 min-w-0">
                                <span class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 text-amber-800 font-black text-sm border border-amber-200/60 shrink-0">
                                    {{ p.seat }}
                                </span>
                                <div class="min-w-0">
                                    <div class="font-bold text-slate-900 text-sm truncate">{{ p.name }}</div>
                                    <div class="text-[11px] text-slate-500 mt-0.5">📍 {{ p.pickupCity }} → {{ p.dropOffCity }}</div>
                                </div>
                            </div>
                            <!-- Combined Status Badges -->
                            <span
                                v-if="p.status === 'pending_payment'"
                                class="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 shrink-0 border border-amber-300"
                            >
                                ⏳ Ожидает оплаты
                            </span>
                            <span
                                v-else-if="p.status === 'cancelled'"
                                class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 shrink-0"
                            >
                                ✕ Отменено
                            </span>
                            <span
                                v-else
                                :class="{
                                    'bg-emerald-100 text-emerald-800 font-black': p.boardingStatus === 'boarded',
                                    'bg-rose-100 text-rose-800 font-black': p.boardingStatus === 'no_show',
                                    'bg-sky-50 text-sky-800 font-bold border border-sky-200': p.boardingStatus === 'pending_boarding'
                                }"
                                class="px-2.5 py-1 rounded-full text-[10px] shrink-0"
                            >
                                {{ p.boardingStatus === 'boarded' ? '✓ Посажен' : (p.boardingStatus === 'no_show' ? '✕ No-show' : '⏳ Ожидает посадки') }}
                            </span>
                        </div>


                        <!-- Contacts & Quick Calls -->
                        <div v-if="p.phone" class="flex items-center gap-2 pt-1 border-t border-slate-50">
                            <a :href="`tel:${p.phone}`" class="flex-1 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all">
                                <span>📞</span> <span>{{ p.phone }}</span>
                            </a>
                            <a :href="getWhatsAppUrl(p)" target="_blank" class="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1 transition-all">
                                <span>💬</span> <span>WhatsApp</span>
                            </a>
                        </div>

                        <!-- Expandable Financial Details -->
                        <div v-if="!isDriver" class="pt-2 border-t border-slate-50 flex items-center justify-between text-xs">
                            <div class="flex items-center gap-3">
                                <div>
                                    <span class="text-[10px] text-slate-400 uppercase block font-bold">Оплата</span>
                                    <span v-if="p.isManual && p.totalPrice === 0" class="text-slate-400 text-[10px] italic">Legacy</span>
                                    <span v-else class="font-bold text-slate-900">{{ p.totalPrice }} сом</span>
                                </div>
                                <div>
                                    <span class="text-[10px] text-emerald-600 uppercase block font-bold">Перевозчику</span>
                                    <span v-if="p.isManual && p.carrierAmount === 0" class="text-slate-400 text-[10px] italic">Legacy</span>
                                    <span v-else class="font-black text-emerald-600">{{ p.carrierAmount }} сом</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <button
                                    @click="openTicketPreview(p.bookingId)"
                                    class="px-2.5 py-1.5 text-slate-700 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 rounded-lg text-xs font-bold"
                                    title="Билет"
                                >
                                    🎫 Билет
                                </button>
                                <button @click="$emit('edit-booking', p.bookingId)" class="p-2 text-slate-400 hover:text-amber-500 rounded-lg bg-slate-50 text-xs font-bold">
                                    ✎
                                </button>
                                <button @click="$emit('delete-booking', p.bookingId)" class="p-2 text-slate-400 hover:text-red-500 rounded-lg bg-slate-50 text-xs font-bold">
                                    🗑
                                </button>
                            </div>
                        </div>
                        <div v-else class="pt-2 border-t border-slate-50 flex items-center justify-between text-xs">
                            <button
                                @click="openTicketPreview(p.bookingId)"
                                class="px-2.5 py-1.5 text-slate-700 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 rounded-lg text-xs font-bold"
                                title="Билет"
                            >
                                🎫 Билет
                            </button>
                            <div class="flex items-center gap-2">
                                <button @click="$emit('edit-booking', p.bookingId)" class="p-2 text-slate-400 hover:text-amber-500 rounded-lg bg-slate-50 text-xs font-bold">
                                    ✎
                                </button>
                                <button @click="$emit('delete-booking', p.bookingId)" class="p-2 text-slate-400 hover:text-red-500 rounded-lg bg-slate-50 text-xs font-bold">
                                    🗑
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODAL 1: SINGLE TICKET PREVIEW & PRINT MODAL -->
        <div v-if="ticketModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <div class="w-full max-w-2xl bg-slate-100 rounded-[32px] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div v-if="ticketModal.loading" class="py-16 text-center space-y-3">
                    <div class="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div class="text-xs font-bold text-slate-600">Загрузка данных билета...</div>
                </div>
                <div v-else-if="ticketModal.data" class="space-y-4">
                    <PassengerTicket
                        :ticket="ticketModal.data"
                        mode="screen"
                        :showControls="true"
                        @close="ticketModal.show = false"
                    />
                </div>
            </div>
        </div>

        <!-- MODAL 2: BULK PRINT TRIP TICKETS PREVIEW -->
        <div v-if="bulkPrintModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <div class="w-full max-w-3xl bg-slate-100 rounded-[32px] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">

                <!-- Bulk Print Header Controls (Hidden when print is triggered) -->
                <div class="no-print flex items-center justify-between gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-md">
                    <div>
                        <div class="text-xs font-black uppercase text-amber-400">POPUTKI.ONLINE • МАССОВАЯ ПЕЧАТЬ БИЛЕТОВ</div>
                        <div class="text-xs text-slate-300 mt-0.5">
                            Рейс #{{ bulkPrintModal.tripInfo?.tripId }}: {{ bulkPrintModal.tripInfo?.fromCity }} → {{ bulkPrintModal.tripInfo?.toCity }} (Билетов: {{ bulkPrintModal.manifest?.length || 0 }})
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button
                            @click="triggerBulkPrint"
                            :disabled="bulkPrintModal.manifest?.length === 0"
                            class="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40"
                        >
                            <span>🖨</span>
                            <span>Печать всех билетов</span>
                        </button>
                        <button
                            @click="bulkPrintModal.show = false"
                            class="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs transition-all active:scale-95"
                            title="Закрыть"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <!-- Loading State -->
                <div v-if="bulkPrintModal.loading" class="py-16 text-center space-y-3">
                    <div class="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div class="text-xs font-bold text-slate-600">Формирование печатных билетов рейса...</div>
                </div>

                <!-- Empty Manifest State -->
                <div v-else-if="bulkPrintModal.manifest?.length === 0" class="py-12 bg-white rounded-2xl text-center space-y-2 p-6">
                    <div class="text-3xl">🎫</div>
                    <div class="font-bold text-slate-800">Нет подтвержденных билетов для печати</div>
                    <p class="text-xs text-slate-400">На этот рейс пока нет подтвержденных бронирований.</p>
                </div>

                <!-- List of Printable Tickets (Rendered sequentially for print) -->
                <div v-else class="space-y-6">
                    <div
                        v-for="t in bulkPrintModal.manifest"
                        :key="t.bookingId"
                        class="page-break-after"
                    >
                        <PassengerTicket
                            :ticket="t"
                            mode="print"
                            :showControls="false"
                        />
                    </div>
                </div>

            </div>
        </div>

    </div>
</template>
