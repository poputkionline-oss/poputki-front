<script>
import api from '../api';

export default {
    name: 'TicketVerificationView',
    data() {
        return {
            token: this.$route.params.token || '',
            loading: true,
            error: null,
            ticket: null
        };
    },
    computed: {
        statusBannerClass() {
            if (!this.ticket) return 'bg-slate-100 text-slate-800 border-slate-300';
            if (this.ticket.status === 'confirmed') return 'bg-emerald-500 text-white';
            if (this.ticket.status === 'pending_payment') return 'bg-amber-500 text-white';
            if (this.ticket.status === 'cancelled') return 'bg-rose-500 text-white';
            return 'bg-slate-700 text-white';
        },
        statusTitle() {
            if (!this.ticket) return '';
            if (this.ticket.status === 'confirmed') {
                const now = new Date().toISOString().split('T')[0];
                if (this.ticket.route?.departureDate < now) {
                    return 'ПОЕЗДКА ЗАВЕРШЕНА';
                }
                return 'ДЕЙСТВИТЕЛЕН';
            }
            if (this.ticket.status === 'pending_payment') return 'ОЖИДАЕТ ОПЛАТЫ';
            if (this.ticket.status === 'cancelled') return 'БИЛЕТ ОТМЕНЕН';
            return this.ticket.statusLabel || 'НЕИЗВЕСТНЫЙ СТАТУС';
        }
    },
    methods: {
        async verifyTicket() {
            if (!this.token) {
                this.error = 'Отсутствует токен проверки';
                this.loading = false;
                return;
            }

            this.loading = true;
            this.error = null;

            try {
                const res = await api.get(`/bus-tickets/verify/${this.token}`);
                if (res.data && res.data.valid && res.data.ticket) {
                    this.ticket = res.data.ticket;
                } else {
                    this.error = res.data?.error || 'Билет не найден';
                }
            } catch (err) {
                console.error('Verify error:', err);
                this.error = err.response?.data?.error || 'Недействительный или поддельный токен билета';
            } finally {
                this.loading = false;
            }
        },
        formatDate(dateStr) {
            if (!dateStr) return '—';
            try {
                const d = new Date(dateStr);
                return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
            } catch (e) {
                return dateStr;
            }
        },
        async startClaimSession() {
            if (this.claiming) return;
            this.claiming = true;
            this.claimError = null;
            try {
                const token = this.$route.params.token;
                const bookingId = this.ticket?.bookingId;
                const res = await api.post('/claims/start-session', {
                    ticketVerificationToken: token,
                    bookingId
                });
                if (res.data?.deepLink) {
                    window.location.href = res.data.deepLink;
                }
            } catch (err) {
                this.claimError = err.response?.data?.error || 'Не удалось сформировать ссылку для Telegram';
            } finally {
                this.claiming = false;
            }
        }
    },
    mounted() {
        this.verifyTicket();
    }
};
</script>

<template>
    <div class="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
        
        <div class="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden">
            
            <!-- Top Branding Header -->
            <div class="bg-slate-950 text-white p-6 text-center relative overflow-hidden">
                <div class="text-2xl font-black tracking-wider text-amber-400">
                    POPUTKI.ONLINE
                </div>
                <div class="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Официальная проверка подлинности билета
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="p-12 text-center space-y-4">
                <div class="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <div class="font-bold text-slate-700 text-sm">Проверка контрольной суммы билета...</div>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="p-8 text-center space-y-4">
                <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
                    ✕
                </div>
                <h3 class="text-xl font-bold text-slate-900">Ошибка проверки билета</h3>
                <p class="text-sm text-slate-600">
                    {{ error }}
                </p>
                <div class="pt-4">
                    <button 
                        @click="$router.push('/')"
                        class="px-6 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all"
                    >
                        На главную
                    </button>
                </div>
            </div>

            <!-- Successful Ticket Verification Display -->
            <div v-else-if="ticket" class="space-y-0">
                
                <!-- Status Headline Banner -->
                <div :class="statusBannerClass" class="p-6 text-center space-y-1">
                    <div class="text-xs font-black uppercase tracking-widest opacity-80">Статус билета</div>
                    <div class="text-2xl sm:text-3xl font-black tracking-wide">
                        {{ statusTitle }}
                    </div>
                </div>

                <!-- Verified Details Grid -->
                <div class="p-6 space-y-4 text-xs">
                    
                    <!-- Ticket # & Seats Box -->
                    <div class="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div>
                            <div class="text-[10px] font-extrabold uppercase text-slate-500">№ БИЛЕТА</div>
                            <div class="text-base font-mono font-black text-slate-900 mt-0.5">
                                {{ ticket.ticketNumber }}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-[10px] font-extrabold uppercase text-slate-500">МЕСТО(А)</div>
                            <div class="text-xl font-black text-amber-600 mt-0.5">
                                {{ ticket.passenger?.seatNumbersDisplay || '—' }}
                            </div>
                        </div>
                    </div>

                    <!-- Route Details -->
                    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div class="text-[10px] font-extrabold uppercase text-slate-500">Маршрут</div>
                        <div class="text-lg font-black text-slate-900 flex items-center gap-2">
                            <span>{{ ticket.route?.fromCity }}</span>
                            <span class="text-amber-500">➡</span>
                            <span>{{ ticket.route?.toCity }}</span>
                        </div>
                        <div class="text-slate-600 flex justify-between pt-1 border-t border-slate-200">
                            <span>📅 Дата: <b>{{ formatDate(ticket.route?.departureDate) }}</b></span>
                            <span>⏰ Время: <b>{{ ticket.route?.departureTime }}</b></span>
                        </div>
                    </div>

                    <!-- Passenger & Boarding -->
                    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-extrabold uppercase text-slate-500">Пассажир</span>
                            <span class="text-[10px] font-bold text-slate-600">Всего мест: {{ ticket.passenger?.passengerCount || 1 }}</span>
                        </div>
                        <div class="font-bold text-sm text-slate-900">
                            {{ ticket.passenger?.primaryName }}
                        </div>
                        <div class="flex justify-between items-center pt-1 border-t border-slate-200">
                            <span>Посадка пассажира:</span>
                            <span class="font-bold text-slate-900">{{ ticket.boardingLabel }}</span>
                        </div>
                    </div>

                    <!-- Bus Info if Available -->
                    <div v-if="ticket.bus?.brand || ticket.bus?.model" class="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                        <div>
                            <div class="text-[10px] font-extrabold uppercase text-slate-500">Автобус</div>
                            <div class="font-bold text-slate-900 mt-0.5">
                                {{ ticket.bus?.brand }} {{ ticket.bus?.model }}
                            </div>
                        </div>
                        <div v-if="ticket.bus?.license_plate" class="font-mono font-bold bg-white px-2 py-1 rounded border border-slate-300">
                            {{ ticket.bus?.license_plate }}
                        </div>
                    </div>

                    <!-- Passenger Telegram Access CTA -->
                    <div v-if="ticket.claimStatus !== 'claimed'" class="p-5 bg-sky-50 rounded-2xl border border-sky-200 text-center space-y-3">
                        <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-sky-200 rounded-full text-[11px] font-bold text-sky-800">
                            <span>POPUTKI.ONLINE</span>
                            <span>•</span>
                            <span>Официальный бот: @Poputkionline_bot</span>
                        </div>
                        <p class="text-xs text-slate-600 leading-relaxed">
                            Подключите Telegram, чтобы получать уведомления об изменениях рейса и сохранить билет в боте.
                        </p>
                        <button
                            @click="startClaimSession"
                            :disabled="claiming"
                            class="w-full py-3.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <span v-if="claiming" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span v-else>✈ Открыть билет в Telegram</span>
                        </button>
                        <div class="text-[10px] text-slate-400">
                            Билет действителен для посадки и без подключения Telegram.
                        </div>
                        <div v-if="claimError" class="text-[11px] font-bold text-rose-600">
                            {{ claimError }}
                        </div>
                    </div>

                    <!-- Disclaimer -->
                    <div class="text-[10px] text-slate-400 text-center pt-2">
                        POPUTKI.ONLINE — информационный сервис (агрегатор), а не перевозчик
                    </div>

                </div>

            </div>

        </div>

    </div>
</template>
