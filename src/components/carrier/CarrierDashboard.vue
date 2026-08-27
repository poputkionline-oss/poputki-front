<template>
  <div class="space-y-6 lg:space-y-8">
    <!-- Header & Refresh -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
      <div>
        <div class="flex items-center gap-3">
          <h2 class="text-2xl sm:text-3xl font-black text-slate-900">Обзор операций</h2>
          <span class="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full text-xs font-bold uppercase tracking-wider">
            Владелец
          </span>
        </div>
        <p class="text-slate-500 text-sm mt-1">
          Оперативные показатели и контроль рейсов на сегодня: 
          <span class="font-bold text-slate-700">{{ formattedBusinessDate }}</span>
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="fetchDashboard" 
          :disabled="loading"
          class="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-sm transition-all border border-slate-200 disabled:opacity-50"
        >
          <svg :class="{'animate-spin': loading}" class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Обновить</span>
        </button>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="p-5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-xl">⚠️</span>
        <span class="font-semibold text-sm">{{ error }}</span>
      </div>
      <button @click="fetchDashboard" class="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700">
        Повторить
      </button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading && !dashboard" class="space-y-6 animate-pulse">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="'skel-kpi-'+i" class="h-28 bg-slate-200 rounded-3xl"></div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="h-56 bg-slate-200 rounded-3xl"></div>
        <div class="h-56 bg-slate-200 rounded-3xl"></div>
      </div>
    </div>

    <!-- Main Dashboard Content -->
    <div v-else-if="dashboard" class="space-y-6 lg:space-y-8">
      
      <!-- Attention Center -->
      <div v-if="dashboard.attention && dashboard.attention.length > 0" class="space-y-3">
        <h3 class="text-sm font-black text-slate-400 uppercase tracking-widest px-1">Требует внимания</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            v-for="item in dashboard.attention" 
            :key="item.id"
            class="p-5 rounded-2xl border flex flex-col justify-between transition-all"
            :class="{
              'bg-rose-50/80 border-rose-200 text-rose-900': item.type === 'CRITICAL',
              'bg-amber-50/80 border-amber-200 text-amber-900': item.type === 'WARNING',
              'bg-blue-50/80 border-blue-200 text-blue-900': item.type === 'INFO'
            }"
          >
            <div class="flex items-start gap-3">
              <span class="text-2xl">{{ item.icon }}</span>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-black text-sm">{{ item.title }}</span>
                  <span 
                    class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                    :class="{
                      'bg-rose-200 text-rose-900': item.type === 'CRITICAL',
                      'bg-amber-200 text-amber-900': item.type === 'WARNING',
                      'bg-blue-200 text-blue-900': item.type === 'INFO'
                    }"
                  >
                    {{ item.type }}
                  </span>
                </div>
                <p class="text-xs mt-1 opacity-90 leading-relaxed">{{ item.message }}</p>
              </div>
            </div>
            
            <div class="mt-4 pt-3 border-t border-current/10 flex justify-end">
              <button 
                @click="navigateToAction(item.action_url)"
                class="px-3 py-1.5 bg-white/80 hover:bg-white text-slate-800 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1"
              >
                <span>Перейти к действию</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 1: Key Operational Metrics on Today -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <!-- Card 1: Рейсы сегодня -->
        <div class="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div class="flex justify-between items-start">
            <span class="text-xs font-black text-slate-400 uppercase tracking-wider">Рейсов сегодня</span>
            <span class="p-2 bg-amber-50 text-amber-600 rounded-xl text-lg">🚌</span>
          </div>
          <div class="mt-4">
            <div class="text-3xl font-black text-slate-900">{{ dashboard.today.trips_count }}</div>
            <div class="text-xs text-slate-500 mt-1">
              Вместимость: <span class="font-bold text-slate-700">{{ dashboard.today.capacity }} мест</span>
            </div>
          </div>
        </div>

        <!-- Card 2: Пассажиров сегодня -->
        <div class="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div class="flex justify-between items-start">
            <span class="text-xs font-black text-slate-400 uppercase tracking-wider">Пассажиров сегодня</span>
            <span class="p-2 bg-indigo-50 text-indigo-600 rounded-xl text-lg">👥</span>
          </div>
          <div class="mt-4">
            <div class="text-3xl font-black text-indigo-600">{{ dashboard.today.passengers_count }}</div>
            <div class="text-xs text-slate-500 mt-1">
              В <span class="font-bold text-slate-700">{{ dashboard.today.confirmed_bookings }}</span> подтвержд. бронях
            </div>
          </div>
        </div>

        <!-- Card 3: Загрузка салонов -->
        <div class="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div class="flex justify-between items-start">
            <span class="text-xs font-black text-slate-400 uppercase tracking-wider">Средняя загрузка</span>
            <span class="p-2 bg-emerald-50 text-emerald-600 rounded-xl text-lg">📊</span>
          </div>
          <div class="mt-4">
            <div class="flex items-baseline gap-2">
              <span class="text-3xl font-black text-emerald-600">{{ dashboard.today.fill_rate }}%</span>
              <span class="text-xs text-slate-400 font-medium">({{ dashboard.today.booked_seats }}/{{ dashboard.today.capacity }})</span>
            </div>
            <!-- Progress bar -->
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
              <div 
                class="bg-emerald-500 h-full transition-all duration-500" 
                :style="{ width: `${dashboard.today.fill_rate}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Card 4: Посадка пассажиров -->
        <div class="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between cursor-pointer hover:border-amber-300 transition-all" @click="$emit('navigate', 'boarding')">
          <div class="flex justify-between items-start">
            <span class="text-xs font-black text-slate-400 uppercase tracking-wider">Посадка сегодня</span>
            <span class="p-2 bg-blue-50 text-blue-600 rounded-xl text-lg">🚪</span>
          </div>
          <div class="mt-4 space-y-1 text-xs">
            <div class="flex justify-between">
              <span class="text-slate-500">Посажено:</span>
              <span class="font-bold text-emerald-600">{{ dashboard.today.boarded }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Ожидают:</span>
              <span class="font-bold text-amber-600">{{ dashboard.today.pending_boarding }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">No-show:</span>
              <span class="font-bold" :class="dashboard.today.no_show > 0 ? 'text-rose-600' : 'text-slate-400'">{{ dashboard.today.no_show }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 2: Finance & Channels Blocks -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Finance Breakdown (2 cols) -->
        <div class="lg:col-span-2 bg-white p-6 sm:p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-6">
              <div>
                <h3 class="text-lg font-black text-slate-900">Финансы сегодняшних рейсов</h3>
                <p class="text-xs text-slate-400 mt-0.5">На основе подтвержденных снапшотов цен</p>
              </div>
              <button 
                @click="$emit('navigate', 'finance')"
                class="text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl transition-all"
              >
                Отчет за период →
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <!-- Gross -->
              <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span class="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1">Сумма броней (Gross)</span>
                <div class="text-xl font-black text-slate-800">{{ formatPrice(dashboard.money.confirmed_gross) }} <span class="text-xs font-normal">с.</span></div>
              </div>

              <!-- Service Commission -->
              <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span class="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1">Сбор сервиса</span>
                <div class="text-xl font-black text-slate-500">-{{ formatPrice(dashboard.money.service_commission) }} <span class="text-xs font-normal">с.</span></div>
              </div>

              <!-- Carrier Net -->
              <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                <span class="text-[11px] font-black text-emerald-800 uppercase tracking-wider block mb-1">К получению перевозчиком</span>
                <div class="text-2xl font-black text-emerald-600">{{ formatPrice(dashboard.money.carrier_receivable) }} <span class="text-xs font-normal">с.</span></div>
              </div>
            </div>
          </div>

          <div v-if="dashboard.money.pending_payment_amount > 0" class="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span class="text-amber-700 font-medium">⏳ Ожидает оплаты (в незавершенных бронях):</span>
            <span class="font-bold text-amber-800">{{ formatPrice(dashboard.money.pending_payment_amount) }} сомони</span>
          </div>
        </div>

        <!-- Online vs Manual Split (1 col) -->
        <div class="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 class="text-lg font-black text-slate-900 mb-1">Каналы продаж</h3>
            <p class="text-xs text-slate-400 mb-6">Онлайн-платформа vs Касса</p>

            <div class="space-y-4">
              <div>
                <div class="flex justify-between text-xs font-bold mb-1.5">
                  <span class="text-amber-600 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                    Онлайн ({{ dashboard.today.online_bookings }})
                  </span>
                  <span class="text-slate-800">{{ dashboard.today.online_share }}%</span>
                </div>
                <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                  <div 
                    class="bg-amber-500 h-full transition-all duration-500" 
                    :style="{ width: `${dashboard.today.online_share}%` }"
                  ></div>
                  <div 
                    class="bg-slate-300 h-full transition-all duration-500" 
                    :style="{ width: `${100 - dashboard.today.online_share}%` }"
                  ></div>
                </div>
              </div>

              <div class="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div class="flex justify-between items-center text-slate-600">
                  <span>🌐 Онлайн (Web / Telegram):</span>
                  <span class="font-bold text-slate-900">{{ dashboard.today.online_bookings }}</span>
                </div>
                <div class="flex justify-between items-center text-slate-600">
                  <span>🏢 Ручные (Касса / Офис):</span>
                  <span class="font-bold text-slate-900">{{ dashboard.today.manual_bookings }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
            Доля онлайн-броней рассчитывается от подтвержденных поездок.
          </div>
        </div>

      </div>

      <!-- Row 3: Upcoming Trips Table -->
      <div class="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-black text-slate-900">Ближайшие отправления</h3>
            <p class="text-xs text-slate-400 mt-0.5">Активные рейсы перевозчика на сегодня и ближайшие даты</p>
          </div>
          <button 
            @click="$emit('navigate', 'tickets')"
            class="text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl transition-all"
          >
            Все рейсы →
          </button>
        </div>

        <div v-if="!dashboard.upcoming_trips || dashboard.upcoming_trips.length === 0" class="text-center py-10 text-slate-400">
          <span class="text-3xl block mb-2">🚌</span>
          <p class="text-sm font-medium">Нет запланированных активных рейсов</p>
        </div>

        <!-- Desktop & Mobile Table/Cards -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr class="border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <th class="py-3 px-2">Отправление</th>
                <th class="py-3 px-2">Маршрут</th>
                <th class="py-3 px-2">Заполняемость</th>
                <th class="py-3 px-2">Брони</th>
                <th class="py-3 px-2">Водитель</th>
                <th class="py-3 px-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50 text-sm">
              <tr v-for="trip in dashboard.upcoming_trips" :key="trip.id" class="hover:bg-slate-50/80 transition-colors">
                <td class="py-4 px-2">
                  <div class="font-bold text-slate-900">{{ trip.departure_date }}</div>
                  <div class="text-xs text-slate-400 font-mono">{{ trip.departure_time ? trip.departure_time.slice(0, 5) : '—' }}</div>
                </td>

                <td class="py-4 px-2">
                  <div class="font-bold text-slate-800">{{ trip.from_city }} → {{ trip.to_city }}</div>
                  <div class="text-xs text-slate-400">#{{ trip.id }} ({{ trip.bus_type === 'double' ? '2-эт.' : '1-эт.' }})</div>
                </td>

                <td class="py-4 px-2">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-800 text-xs">{{ trip.fill_rate }}%</span>
                    <span class="text-[11px] text-slate-400">({{ trip.booked_seats }}/{{ trip.capacity }})</span>
                  </div>
                  <div class="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                    <div 
                      class="bg-emerald-500 h-full" 
                      :style="{ width: `${trip.fill_rate}%` }"
                    ></div>
                  </div>
                </td>

                <td class="py-4 px-2">
                  <div class="text-xs">
                    <span class="font-bold text-emerald-600">{{ trip.confirmed_bookings }}</span> подтв.
                    <span v-if="trip.pending_payment_count > 0" class="text-amber-600 font-semibold ml-1">
                      ({{ trip.pending_payment_count }} ожид.)
                    </span>
                  </div>
                </td>

                <td class="py-4 px-2">
                  <span 
                    v-if="trip.has_assigned_driver" 
                    class="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"
                  >
                    ✓ Назначен
                  </span>
                  <span 
                    v-else 
                    class="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full"
                  >
                    ⚠ Не назначен
                  </span>
                </td>

                <td class="py-4 px-2 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button 
                      @click="$emit('navigate', 'boarding')"
                      class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                    >
                      Посадка
                    </button>
                    <button 
                      @click="$emit('navigate', 'bookings')"
                      class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold transition-all"
                    >
                      Брони
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Row 4: Recent Team Activity -->
      <div class="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-black text-slate-900">Последние действия команды</h3>
            <p class="text-xs text-slate-400 mt-0.5">Операционный аудит изменений в режиме реального времени</p>
          </div>
          <button 
            @click="$emit('navigate', 'activity')"
            class="text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl transition-all"
          >
            Вся история →
          </button>
        </div>

        <div v-if="!dashboard.recent_activity || dashboard.recent_activity.length === 0" class="text-center py-6 text-slate-400 text-xs">
          Действий команды пока не зафиксировано
        </div>

        <div v-else class="space-y-3">
          <div 
            v-for="log in dashboard.recent_activity" 
            :key="log.id"
            class="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
          >
            <div class="flex items-center gap-3">
              <span class="p-2 rounded-xl bg-white border border-slate-200/70 text-slate-600 shadow-2xs font-bold text-[11px]">
                {{ formatActionCode(log.action) }}
              </span>
              <div>
                <span class="font-bold text-slate-900">{{ log.entity_label || log.entity_type }}</span>
                <div class="text-slate-400 text-[11px] mt-0.5">
                  Выполнил: <span class="font-medium text-slate-600">{{ log.actor_name || log.actor_role }}</span>
                </div>
              </div>
            </div>

            <div class="text-slate-400 text-[11px] font-mono shrink-0">
              {{ formatDate(log.created_at) }}
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import api from '../../api';

export default {
  name: 'CarrierDashboard',
  emits: ['navigate'],
  data() {
    return {
      loading: false,
      error: null,
      dashboard: null
    };
  },
  computed: {
    formattedBusinessDate() {
      if (!this.dashboard?.business_date) return '';
      try {
        const [y, m, d] = this.dashboard.business_date.split('-');
        return `${d}.${m}.${y}`;
      } catch (e) {
        return this.dashboard.business_date;
      }
    }
  },
  mounted() {
    this.fetchDashboard();
  },
  methods: {
    async fetchDashboard() {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get('/bus-admin/dashboard');
        this.dashboard = res.data;
      } catch (err) {
        console.error('[CarrierDashboard] Fetch error:', err);
        const status = err.response?.status;
        if (status === 403) {
          this.error = 'Доступ к управленческому дашборду разрешен только владельцу компании.';
        } else {
          this.error = 'Не удалось загрузить данные дашборда. Пожалуйста, попробуйте снова.';
        }
      } finally {
        this.loading = false;
      }
    },
    formatPrice(val) {
      if (val === null || val === undefined) return '0';
      return Number(val).toLocaleString('ru-RU');
    },
    formatDate(dateStr) {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + ', ' +
               d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      } catch (e) {
        return dateStr;
      }
    },
    formatActionCode(action) {
      const map = {
        booking_created_manual: 'Создана бронь',
        booking_updated: 'Изменена бронь',
        booking_cancelled: 'Отмена брони',
        boarding_status_changed: 'Посадка',
        ticket_created: 'Создан рейс',
        ticket_updated: 'Изменен рейс',
        ticket_duplicated: 'Копия рейса',
        ticket_reversed: 'Обратный рейс',
        ticket_deleted: 'Удален рейс',
        member_added: 'Добавлен сотрудник',
        member_role_changed: 'Смена роли',
        member_deactivated: 'Деактивация',
        member_reactivated: 'Активация',
        driver_assignment_changed: 'Назначен водитель'
      };
      return map[action] || action;
    },
    navigateToAction(url) {
      if (!url) return;
      if (url.includes('tab=team')) {
        this.$emit('navigate', 'team');
      } else if (url.includes('tab=boarding')) {
        this.$emit('navigate', 'boarding');
      } else if (url.includes('tab=bookings')) {
        this.$emit('navigate', 'bookings');
      } else if (url.includes('tab=tickets')) {
        this.$emit('navigate', 'tickets');
      }
    }
  }
};
</script>
