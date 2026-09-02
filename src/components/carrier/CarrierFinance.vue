<script>
import api from '../../api';

export default {
    name: 'CarrierFinance',
    props: {
        user: {
            type: Object,
            default: null
        }
    },
    emits: ['select-trip-bookings'],
    data() {
        return {
            periodPreset: 'this_month', // 'today' | '7days' | 'this_month' | 'last_month' | 'custom'
            customFrom: '',
            customTo: '',
            loading: false,
            financeData: null,
            errorMsg: '',
            searchQuery: ''
        };
    },
    computed: {
        isDriver() {
            return this.user?.role === 'driver';
        },
        dateRange() {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth(); // 0-indexed

            if (this.periodPreset === 'today') {
                const todayStr = now.toISOString().split('T')[0];
                return { from: todayStr, to: todayStr };
            }
            if (this.periodPreset === '7days') {
                const past7 = new Date(now);
                past7.setDate(past7.getDate() - 6);
                return {
                    from: past7.toISOString().split('T')[0],
                    to: now.toISOString().split('T')[0]
                };
            }
            if (this.periodPreset === 'this_month') {
                const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
                const lastDay = new Date(year, month + 1, 0).getDate();
                const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                return { from, to };
            }
            if (this.periodPreset === 'last_month') {
                const prevMonth = month === 0 ? 11 : month - 1;
                const prevYear = month === 0 ? year - 1 : year;
                const from = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
                const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
                const to = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                return { from, to };
            }
            if (this.periodPreset === 'custom') {
                return {
                    from: this.customFrom || `${year}-${String(month + 1).padStart(2, '0')}-01`,
                    to: this.customTo || now.toISOString().split('T')[0]
                };
            }
            return { from: '', to: '' };
        },
        filteredTrips() {
            if (!this.financeData || !this.financeData.trips) return [];
            if (!this.searchQuery.trim()) return this.financeData.trips;
            const q = this.searchQuery.toLowerCase().trim();
            return this.financeData.trips.filter(t => {
                return (
                    (t.from_city && t.from_city.toLowerCase().includes(q)) ||
                    (t.to_city && t.to_city.toLowerCase().includes(q)) ||
                    (t.departure_date && t.departure_date.includes(q))
                );
            });
        }
    },
    watch: {
        dateRange: {
            immediate: true,
            handler() {
                this.fetchFinance();
            }
        }
    },
    mounted() {
        if (!this.financeData && !this.loading) {
            this.fetchFinance();
        }
    },
    methods: {
        refresh() {
            return this.fetchFinance();
        },
        setPreset(preset) {
            this.periodPreset = preset;
            if (preset === 'custom' && !this.customFrom) {
                const now = new Date();
                this.customFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                this.customTo = now.toISOString().split('T')[0];
            }
        },
        async fetchFinance() {
            if (this.isDriver) return;
            this.loading = true;
            this.errorMsg = '';
            try {
                const params = {
                    from: this.dateRange.from,
                    to: this.dateRange.to
                };
                const res = await api.get('/bus-admin/finance', { params });
                this.financeData = res.data;
            } catch (err) {
                console.error('[CarrierFinance] Error fetching finance data:', err);
                this.errorMsg = err.response?.data?.error || 'Ошибка загрузки финансовых показателей';
                this.financeData = null;
            } finally {
                this.loading = false;
            }
        },
        formatDate(dateStr) {
            if (!dateStr) return '—';
            const d = new Date(dateStr);
            return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
        },
        formatTime(timeStr) {
            if (!timeStr) return '';
            return timeStr.substring(0, 5);
        },
        exportExcel() {
            if (!this.financeData || !this.financeData.trips || this.financeData.trips.length === 0) return;

            import('xlsx').then(XLSX => {
                // Sheet 1: Trips
                const tripRows = this.financeData.trips.map(t => ({
                    'ID рейса': t.ticket_id,
                    'Дата': t.departure_date,
                    'Время': t.departure_time,
                    'Откуда': t.from_city,
                    'Куда': t.to_city,
                    'Вместимость': t.capacity,
                    'Занято мест': t.booked_seats,
                    'Заполняемость (%)': t.fill_rate,
                    'Онлайн броней': t.online_bookings,
                    'Ручных броней': t.manual_bookings,
                    'Выручка (сомони)': t.confirmed_gross,
                    'Комиссия POPUTKI (сомони)': t.service_commission,
                    'Перевозчику (сомони)': t.carrier_amount,
                    'Ожидает оплаты (сомони)': t.pending_amount,
                    'Посажено': t.boarding?.boarded || 0,
                    'Не явились': t.boarding?.no_show || 0
                }));

                // Sheet 2: Channels
                const sourceRows = (this.financeData.source_breakdown || []).map(s => ({
                    'Канал продаж': s.label,
                    'Число броней': s.count,
                    'Выручка (сомони)': s.gross,
                    'Комиссия (сомони)': s.commission,
                    'Перевозчику (сомони)': s.carrier_amount
                }));

                const wb = XLSX.utils.book_new();
                const wsTrips = XLSX.utils.json_to_sheet(tripRows);
                const wsSources = XLSX.utils.json_to_sheet(sourceRows);

                XLSX.utils.book_append_sheet(wb, wsTrips, 'Сводка по рейсам');
                XLSX.utils.book_append_sheet(wb, wsSources, 'Каналы продаж');

                const fileName = `Финансовый_отчет_${this.dateRange.from}_${this.dateRange.to}.xlsx`;
                XLSX.writeFile(wb, fileName);
            }).catch(e => {
                console.error('Error exporting Excel:', e);
            });
        }
    }
};
</script>

<template>
    <div class="space-y-6">
        
        <!-- DRIVER SECURITY RESTRICTION GATE -->
        <div v-if="isDriver" class="bg-amber-50 border border-amber-200 p-8 rounded-[28px] text-center space-y-2">
            <div class="text-3xl">🔒</div>
            <h3 class="text-lg font-bold text-amber-900">Доступ ограничен</h3>
            <p class="text-xs text-amber-700 max-w-md mx-auto">
                Финансовый отчет и расчеты доступны только для ролей администратора и диспетчера компании.
            </p>
        </div>

        <div v-else class="space-y-6">

            <!-- STEP 1: PERIOD & CONTROLS HEADER -->
            <div class="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm space-y-4">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <span>💼</span> Финансы и взаиморасчеты
                        </h2>
                        <p class="text-xs text-slate-500">
                            Финансовые показатели за период: 
                            <span class="font-bold text-slate-800">{{ formatDate(dateRange.from) }} — {{ formatDate(dateRange.to) }}</span>
                        </p>
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <button 
                            @click="exportExcel"
                            :disabled="loading || !financeData || financeData.trips?.length === 0"
                            class="px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 font-bold text-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40"
                        >
                            <span>📊</span> <span>Экспорт в Excel</span>
                        </button>
                        <button 
                            @click="fetchFinance" 
                            :disabled="loading"
                            class="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-600 active:scale-95 transition-all text-xs font-semibold"
                            title="Обновить"
                        >
                            <span>↻</span>
                        </button>
                    </div>
                </div>

                <!-- Period Presets Bar -->
                <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-50">
                    <div class="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
                        <button 
                            @click="setPreset('today')"
                            :class="periodPreset === 'today' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                            class="px-3 py-1.5 rounded-xl transition-all"
                        >
                            Сегодня
                        </button>
                        <button 
                            @click="setPreset('7days')"
                            :class="periodPreset === '7days' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                            class="px-3 py-1.5 rounded-xl transition-all"
                        >
                            7 дней
                        </button>
                        <button 
                            @click="setPreset('this_month')"
                            :class="periodPreset === 'this_month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                            class="px-3 py-1.5 rounded-xl transition-all"
                        >
                            Этот месяц
                        </button>
                        <button 
                            @click="setPreset('last_month')"
                            :class="periodPreset === 'last_month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                            class="px-3 py-1.5 rounded-xl transition-all"
                        >
                            Прошлый месяц
                        </button>
                        <button 
                            @click="setPreset('custom')"
                            :class="periodPreset === 'custom' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                            class="px-3 py-1.5 rounded-xl transition-all"
                        >
                            Выбрать даты
                        </button>
                    </div>

                    <!-- Custom Date Inputs -->
                    <div v-if="periodPreset === 'custom'" class="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/60">
                        <input 
                            v-model="customFrom" 
                            type="date" 
                            class="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-800 font-bold outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <span class="text-xs text-slate-400 font-bold">—</span>
                        <input 
                            v-model="customTo" 
                            type="date" 
                            class="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-800 font-bold outline-none focus:ring-1 focus:ring-amber-500"
                        />
                    </div>
                </div>
            </div>

            <!-- LOADING STATE -->
            <div v-if="loading" class="bg-white p-12 rounded-[28px] border border-slate-100 text-center shadow-sm space-y-3 animate-pulse">
                <div class="h-8 w-48 bg-slate-100 rounded-xl mx-auto"></div>
                <div class="h-4 w-64 bg-slate-50 rounded-lg mx-auto"></div>
            </div>

            <!-- ERROR STATE -->
            <div v-else-if="errorMsg" class="bg-rose-50 border border-rose-200 p-6 rounded-[28px] text-center text-rose-800 space-y-2">
                <div class="text-2xl">⚠️</div>
                <div class="font-bold text-sm">{{ errorMsg }}</div>
                <button @click="fetchFinance" class="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-rose-700 transition-all">
                    Повторить
                </button>
            </div>

            <!-- MAIN CONTENT -->
            <div v-else class="space-y-6">

                <!-- ROW 1: PRIMARY FINANCIAL TOTALS CARDS -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <!-- 1. GROSS CONFIRMED REVENUE -->
                    <div class="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-[28px] shadow-lg relative overflow-hidden">
                        <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Общий оборот (Оплачено)</div>
                        <div class="text-2xl sm:text-3xl font-black text-white mt-1">
                            {{ financeData?.totals?.confirmed_gross || 0 }} <span class="text-xs font-bold text-slate-400">сом</span>
                        </div>
                        <div class="text-[10px] text-slate-400 mt-2 flex items-center justify-between">
                            <span>Онлайн: {{ financeData?.totals?.online_amount || 0 }} сом</span>
                            <span>Ручные: {{ financeData?.totals?.manual_amount || 0 }} сом</span>
                        </div>
                    </div>

                    <!-- 2. SERVICE FEE (10%) -->
                    <div class="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm">
                        <div class="text-[10px] font-black uppercase tracking-wider text-amber-600">Сбор платформы (10%)</div>
                        <div class="text-2xl sm:text-3xl font-black text-amber-600 mt-1">
                            {{ financeData?.totals?.service_commission || 0 }} <span class="text-xs font-bold text-amber-600/70">сом</span>
                        </div>
                        <div class="text-[10px] text-slate-400 mt-2">
                            Только с подтвержденных онлайн-броней
                        </div>
                    </div>

                    <!-- 3. CARRIER NET PAYOUT -->
                    <div class="bg-emerald-50/70 border border-emerald-200/60 p-5 rounded-[28px] shadow-sm">
                        <div class="text-[10px] font-black uppercase tracking-wider text-emerald-800">К выплате перевозчику</div>
                        <div class="text-2xl sm:text-3xl font-black text-emerald-700 mt-1">
                            {{ financeData?.totals?.carrier_amount || 0 }} <span class="text-xs font-bold text-emerald-700/70">сом</span>
                        </div>
                        <div class="text-[10px] text-emerald-800/80 mt-2">
                            Чистая выручка за период
                        </div>
                    </div>

                    <!-- 4. PENDING REVENUE -->
                    <div class="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm">
                        <div class="text-[10px] font-black uppercase tracking-wider text-sky-600">Ожидает оплаты</div>
                        <div class="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                            {{ financeData?.totals?.pending_amount || 0 }} <span class="text-xs font-bold text-slate-400">сом</span>
                        </div>
                        <div class="text-[10px] text-slate-400 mt-2">
                            {{ financeData?.booking_counts?.pending_payment || 0 }} бронирований в обработке
                        </div>
                    </div>
                </div>

                <!-- ROW 2: OPERATIONAL METRICS -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div class="text-[10px] font-bold text-slate-400 uppercase">Онлайн броней</div>
                        <div class="text-xl font-black text-slate-800 mt-1">
                            {{ financeData?.totals?.online_bookings || 0 }} <span class="text-xs font-bold text-slate-400">билетов</span>
                        </div>
                    </div>
                    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div class="text-[10px] font-bold text-slate-400 uppercase">Ручных броней</div>
                        <div class="text-xl font-black text-slate-800 mt-1">
                            {{ financeData?.totals?.manual_bookings || 0 }} <span class="text-xs font-bold text-slate-400">билетов</span>
                        </div>
                    </div>
                    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div class="text-[10px] font-bold text-slate-400 uppercase">Посажено пассажиров</div>
                        <div class="text-xl font-black text-emerald-600 mt-1">
                            {{ financeData?.boarding?.boarded || 0 }} <span class="text-xs font-bold text-slate-400">/ {{ financeData?.boarding?.total || 0 }}</span>
                        </div>
                    </div>
                    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div class="text-[10px] font-bold text-slate-400 uppercase">Отмен броней</div>
                        <div class="text-xl font-black text-rose-600 mt-1">
                            {{ financeData?.booking_counts?.cancelled || 0 }} <span class="text-xs font-bold text-slate-400">отмен</span>
                        </div>
                    </div>
                </div>

                <!-- ROW 3: SOURCE BREAKDOWN ANALYTICS -->
                <div v-if="financeData?.source_breakdown?.length > 0" class="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm space-y-4">
                    <div class="flex items-center justify-between">
                        <h3 class="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                            <span>📈</span> Аналитика каналов продаж
                        </h3>
                        <span class="text-xs text-slate-400">Распределение выручки по источникам</span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div 
                            v-for="s in financeData.source_breakdown" 
                            :key="s.key" 
                            class="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5"
                        >
                            <div class="flex items-center justify-between">
                                <span class="font-bold text-xs text-slate-900">{{ s.label }}</span>
                                <span class="px-2 py-0.5 rounded-full bg-white text-[10px] font-black text-slate-700 border border-slate-200/60">
                                    {{ s.count }} броней
                                </span>
                            </div>
                            <div class="text-base font-black text-slate-900">
                                {{ s.gross }} сом
                            </div>
                            <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                                <span>Сбор: <b class="text-amber-600">{{ s.commission }} сом</b></span>
                                <span>Перевозчику: <b class="text-emerald-600">{{ s.carrier_amount }} сом</b></span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ROW 4: TRIPS FINANCIAL BREAKDOWN TABLE -->
                <div class="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 class="font-bold text-base text-slate-900 flex items-center gap-1.5">
                                <span>🚌</span> Финансовая сводка по рейсам
                            </h3>
                            <p class="text-xs text-slate-500">Всего рейсов за период: {{ financeData?.trips?.length || 0 }}</p>
                        </div>
                        
                        <div class="relative w-full sm:w-72">
                            <input 
                                v-model="searchQuery" 
                                type="text"
                                placeholder="Поиск рейса по городу или дате..." 
                                class="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-4 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
                            />
                            <span class="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                        </div>
                    </div>

                    <!-- EMPTY TRIPS -->
                    <div v-if="filteredTrips.length === 0" class="py-12 text-center space-y-2">
                        <div class="text-2xl">📋</div>
                        <div class="font-bold text-sm text-slate-700">Рейсы не найдены</div>
                        <p class="text-xs text-slate-400">За выбранный период рейсы отсутствуют.</p>
                    </div>

                    <div v-else class="space-y-3">
                        <!-- DESKTOP TABLE -->
                        <div class="hidden lg:block overflow-x-auto rounded-2xl border border-slate-100">
                            <table class="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr class="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100">
                                        <th class="px-4 py-3.5">ДАТА И РЕЙС</th>
                                        <th class="px-4 py-3.5">ЗАГРУЗКА</th>
                                        <th class="px-4 py-3.5">БРОНИ</th>
                                        <th class="px-4 py-3.5">ВЫРУЧКА</th>
                                        <th class="px-4 py-3.5">СБОР (10%)</th>
                                        <th class="px-4 py-3.5">ПЕРЕВОЗЧИКУ</th>
                                        <th class="px-4 py-3.5">ОЖИДАЕТ</th>
                                        <th class="px-4 py-3.5">ПОСАДКА</th>
                                        <th class="px-4 py-3.5 text-right">ДЕЙСТВИЕ</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-50">
                                    <tr v-for="t in filteredTrips" :key="t.ticket_id" class="hover:bg-slate-50/50 transition-colors">
                                        <!-- Date & Route -->
                                        <td class="px-4 py-3.5">
                                            <div class="font-bold text-slate-900">{{ t.from_city }} → {{ t.to_city }}</div>
                                            <div class="text-[10px] text-slate-400 mt-0.5">
                                                📅 {{ formatDate(t.departure_date) }} в {{ formatTime(t.departure_time) }}
                                            </div>
                                        </td>

                                        <!-- Occupancy -->
                                        <td class="px-4 py-3.5">
                                            <div class="font-bold text-slate-800">{{ t.booked_seats }} / {{ t.capacity }} мест</div>
                                            <div class="text-[10px] text-amber-600 font-black">{{ t.fill_rate }}%</div>
                                        </td>

                                        <!-- Bookings -->
                                        <td class="px-4 py-3.5">
                                            <span class="text-slate-800 font-bold">{{ t.confirmed_bookings }}</span>
                                            <span class="text-[10px] text-slate-400 block mt-0.5">
                                                {{ t.online_bookings }} онл. / {{ t.manual_bookings }} ручн.
                                            </span>
                                        </td>

                                        <!-- Gross -->
                                        <td class="px-4 py-3.5 font-bold text-slate-900">
                                            {{ t.confirmed_gross }} сом
                                        </td>

                                        <!-- Commission -->
                                        <td class="px-4 py-3.5 font-bold text-amber-600">
                                            {{ t.service_commission }} сом
                                        </td>

                                        <!-- Carrier Net -->
                                        <td class="px-4 py-3.5 font-black text-emerald-600">
                                            {{ t.carrier_amount }} сом
                                        </td>

                                        <!-- Pending -->
                                        <td class="px-4 py-3.5 font-bold text-sky-600">
                                            {{ t.pending_amount > 0 ? t.pending_amount + ' сом' : '—' }}
                                        </td>

                                        <!-- Boarding -->
                                        <td class="px-4 py-3.5">
                                            <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-200/60">
                                                {{ t.boarding?.boarded || 0 }} / {{ t.boarding?.total || 0 }}
                                            </span>
                                        </td>

                                        <!-- Action -->
                                        <td class="px-4 py-3.5 text-right">
                                            <button 
                                                @click="$emit('select-trip-bookings', t.ticket_id)"
                                                class="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all active:scale-95"
                                            >
                                                Детали →
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- MOBILE CARDS (<=390px) -->
                        <div class="lg:hidden space-y-3">
                            <div 
                                v-for="t in filteredTrips" 
                                :key="`m_${t.ticket_id}`" 
                                class="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3"
                            >
                                <div class="flex items-start justify-between gap-2">
                                    <div>
                                        <div class="font-bold text-sm text-slate-900">{{ t.from_city }} → {{ t.to_city }}</div>
                                        <div class="text-[11px] text-slate-400 mt-0.5">
                                            📅 {{ formatDate(t.departure_date) }} в {{ formatTime(t.departure_time) }}
                                        </div>
                                    </div>
                                    <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black shrink-0">
                                        {{ t.fill_rate }}% мест
                                    </span>
                                </div>

                                <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                                    <div>
                                        <span class="text-[10px] text-slate-400 block font-bold uppercase">Оборот</span>
                                        <span class="font-bold text-slate-900">{{ t.confirmed_gross }} сом</span>
                                    </div>
                                    <div>
                                        <span class="text-[10px] text-emerald-600 block font-bold uppercase">Перевозчику</span>
                                        <span class="font-black text-emerald-600">{{ t.carrier_amount }} сом</span>
                                    </div>
                                </div>

                                <div class="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                                    <span class="text-[10px] text-slate-500">
                                        Посадка: <b>{{ t.boarding?.boarded || 0 }} / {{ t.boarding?.total || 0 }}</b>
                                    </span>
                                    <button 
                                        @click="$emit('select-trip-bookings', t.ticket_id)"
                                        class="px-3 py-1 rounded-xl bg-slate-900 text-white font-bold text-xs"
                                    >
                                        Детали рейса →
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

        </div>

    </div>
</template>
