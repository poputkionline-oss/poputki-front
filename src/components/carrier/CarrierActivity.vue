<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-2xl lg:text-3xl font-bold text-slate-900">История действий</h2>
        <p class="text-xs text-slate-400 mt-1 uppercase tracking-widest font-black">
          Неизменяемый журнал аудита операций в кабинете перевозчика
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="fetchActivity(1)"
          :disabled="loading"
          class="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all shadow-sm flex items-center gap-1.5"
        >
          <span :class="{ 'animate-spin': loading }">🔄</span>
          <span>Обновить</span>
        </button>
      </div>
    </div>

    <!-- Filters & Search Toolbar -->
    <div class="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <!-- Search by ID -->
        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Поиск по ID объекта</label>
          <div class="relative">
            <input
              v-model="filters.entity_id"
              @input="onSearchInput"
              type="text"
              placeholder="ID рейса, брони..."
              class="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition-all font-mono"
            />
            <button
              v-if="filters.entity_id"
              @click="filters.entity_id = ''; fetchActivity(1)"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- Entity Type Filter -->
        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Тип объекта</label>
          <select
            v-model="filters.entity_type"
            @change="fetchActivity(1)"
            class="w-full bg-slate-50 border border-slate-100 rounded-2xl px-3.5 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="">Все объекты</option>
            <option value="booking">Бронирования</option>
            <option value="ticket">Рейсы</option>
            <option value="member">Команда</option>
          </select>
        </div>

        <!-- Action Filter -->
        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Действие</label>
          <select
            v-model="filters.action"
            @change="fetchActivity(1)"
            class="w-full bg-slate-50 border border-slate-100 rounded-2xl px-3.5 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="">Все действия</option>
            <optgroup label="Бронирования">
              <option value="booking_created_manual">Ручная бронь</option>
              <option value="booking_updated">Изменение брони</option>
              <option value="booking_cancelled">Отмена брони</option>
              <option value="boarding_status_changed">Статус посадки</option>
            </optgroup>
            <optgroup label="Рейсы">
              <option value="ticket_created">Создан рейс</option>
              <option value="ticket_updated">Изменен рейс</option>
              <option value="ticket_duplicated">Дублирован рейс</option>
              <option value="ticket_reversed">Обратный рейс</option>
              <option value="ticket_deleted">Удален рейс</option>
            </optgroup>
            <optgroup label="Команда">
              <option value="member_added">Добавлен сотрудник</option>
              <option value="member_role_changed">Изменена роль</option>
              <option value="member_deactivated">Отключен сотрудник</option>
              <option value="member_reactivated">Включен сотрудник</option>
              <option value="driver_assignment_changed">Назначены рейсы</option>
            </optgroup>
          </select>
        </div>

        <!-- Period Filter -->
        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Период</label>
          <select
            v-model="selectedPeriod"
            @change="onPeriodChange"
            class="w-full bg-slate-50 border border-slate-100 rounded-2xl px-3.5 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">За все время</option>
            <option value="today">Сегодня</option>
            <option value="7days">Последние 7 дней</option>
            <option value="30days">Последние 30 дней</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Activity Log List (Desktop Table) -->
    <div class="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hidden md:block">
      <div v-if="loading && activities.length === 0" class="p-12 text-center text-slate-400 text-sm">
        <span class="inline-block animate-spin mr-2">🔄</span> Загрузка журнала активности...
      </div>

      <div v-else-if="activities.length === 0" class="p-12 text-center space-y-3">
        <div class="text-4xl">📜</div>
        <h3 class="text-base font-bold text-slate-900">Записей в истории пока нет</h3>
        <p class="text-xs text-slate-400 max-w-sm mx-auto">
          Все действия сотрудников с рейсами, бронированиями и посадкой будут автоматически фиксироваться здесь.
        </p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
            <tr>
              <th class="py-3.5 px-4">Дата / Время</th>
              <th class="py-3.5 px-4">Сотрудник</th>
              <th class="py-3.5 px-4">Действие</th>
              <th class="py-3.5 px-4">Объект</th>
              <th class="py-3.5 px-4">Изменение</th>
              <th class="py-3.5 px-4 text-right">Детали</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-700">
            <tr v-for="item in activities" :key="item.id" class="hover:bg-slate-50/70 transition-colors">
              <!-- Date / Time -->
              <td class="py-3.5 px-4 whitespace-nowrap">
                <div class="font-bold text-slate-900">{{ formatDate(item.created_at) }}</div>
                <div class="text-[10px] font-mono text-slate-400">{{ formatTime(item.created_at) }}</div>
              </td>

              <!-- Actor -->
              <td class="py-3.5 px-4">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700">
                    {{ getActorInitials(item.actor_name) }}
                  </div>
                  <div>
                    <div class="font-bold text-slate-900 text-xs">{{ item.actor_name || 'Сотрудник' }}</div>
                    <span :class="getRoleBadgeClass(item.actor_role)" class="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider">
                      {{ getRoleLabel(item.actor_role) }}
                    </span>
                  </div>
                </div>
              </td>

              <!-- Action Badge -->
              <td class="py-3.5 px-4">
                <span :class="getActionBadgeClass(item.action)" class="px-2.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5">
                  <span>{{ getActionIcon(item.action) }}</span>
                  <span>{{ getActionLabel(item.action) }}</span>
                </span>
              </td>

              <!-- Entity -->
              <td class="py-3.5 px-4">
                <div class="font-bold text-slate-800">{{ item.entity_label || ('#' + item.entity_id) }}</div>
                <div class="text-[10px] font-mono text-slate-400 uppercase">{{ item.entity_type }} #{{ item.entity_id }}</div>
              </td>

              <!-- Diff Preview -->
              <td class="py-3.5 px-4 max-w-xs">
                <div class="text-[11px] text-slate-600 truncate">
                  {{ formatDiffSummary(item) }}
                </div>
              </td>

              <!-- Details Button -->
              <td class="py-3.5 px-4 text-right">
                <button
                  @click="openDetails(item)"
                  class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-all"
                >
                  Детали
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Mobile Card View -->
    <div class="md:hidden space-y-3">
      <div v-if="loading && activities.length === 0" class="bg-white rounded-3xl p-8 text-center text-slate-400 text-xs">
        <span class="inline-block animate-spin mr-2">🔄</span> Загрузка...
      </div>

      <div v-else-if="activities.length === 0" class="bg-white rounded-3xl p-8 text-center text-slate-400 text-xs">
        Записей в истории пока нет
      </div>

      <div
        v-else
        v-for="item in activities"
        :key="'m-'+item.id"
        class="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-3"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700">
              {{ getActorInitials(item.actor_name) }}
            </div>
            <div>
              <div class="font-bold text-slate-900 text-xs">{{ item.actor_name || 'Сотрудник' }}</div>
              <span :class="getRoleBadgeClass(item.actor_role)" class="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider">
                {{ getRoleLabel(item.actor_role) }}
              </span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-[11px] font-bold text-slate-800">{{ formatDate(item.created_at) }}</div>
            <div class="text-[10px] font-mono text-slate-400">{{ formatTime(item.created_at) }}</div>
          </div>
        </div>

        <div>
          <span :class="getActionBadgeClass(item.action)" class="px-2.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5">
            <span>{{ getActionIcon(item.action) }}</span>
            <span>{{ getActionLabel(item.action) }}</span>
          </span>
        </div>

        <div class="bg-slate-50 p-3 rounded-2xl text-xs space-y-1">
          <div class="font-bold text-slate-800">{{ item.entity_label || ('#' + item.entity_id) }}</div>
          <div class="text-[10px] text-slate-500">{{ formatDiffSummary(item) }}</div>
        </div>

        <div class="text-right">
          <button
            @click="openDetails(item)"
            class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all w-full"
          >
            Показать полный diff
          </button>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 1" class="flex justify-between items-center bg-white rounded-2xl p-4 border border-slate-100 text-xs font-bold text-slate-600">
      <div>
        Стр. {{ pagination.page }} из {{ pagination.totalPages }} (Всего: {{ pagination.total }})
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="fetchActivity(pagination.page - 1)"
          :disabled="pagination.page <= 1 || loading"
          class="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Назад
        </button>
        <button
          @click="fetchActivity(pagination.page + 1)"
          :disabled="pagination.page >= pagination.totalPages || loading"
          class="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Вперед →
        </button>
      </div>
    </div>

    <!-- Details Modal -->
    <div
      v-if="selectedActivity"
      class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      @click.self="selectedActivity = null"
    >
      <div class="bg-white rounded-[32px] max-w-lg w-full p-6 lg:p-8 space-y-6 shadow-2xl animate-fade-in my-8 max-h-[90vh] overflow-y-auto">
        <!-- Modal Header -->
        <div class="flex justify-between items-start">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span :class="getActionBadgeClass(selectedActivity.action)" class="px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5">
                <span>{{ getActionIcon(selectedActivity.action) }}</span>
                <span>{{ getActionLabel(selectedActivity.action) }}</span>
              </span>
            </div>
            <h3 class="text-lg font-bold text-slate-900">{{ selectedActivity.entity_label || ('#' + selectedActivity.entity_id) }}</h3>
          </div>
          <button
            @click="selectedActivity = null"
            class="w-9 h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm transition-all"
          >
            ✕
          </button>
        </div>

        <!-- Meta Info Grid -->
        <div class="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl text-xs">
          <div>
            <span class="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Сотрудник</span>
            <span class="font-bold text-slate-800">{{ selectedActivity.actor_name || 'Не указан' }} ({{ getRoleLabel(selectedActivity.actor_role) }})</span>
          </div>
          <div>
            <span class="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Дата / Время</span>
            <span class="font-bold text-slate-800">{{ formatDate(selectedActivity.created_at) }} {{ formatTime(selectedActivity.created_at) }}</span>
          </div>
          <div>
            <span class="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Объект</span>
            <span class="font-mono text-slate-800">{{ selectedActivity.entity_type }} #{{ selectedActivity.entity_id }}</span>
          </div>
          <div>
            <span class="block text-[10px] font-black text-slate-400 uppercase tracking-wider">ID записи аудита</span>
            <span class="font-mono text-slate-800">#{{ selectedActivity.id }}</span>
          </div>
        </div>

        <!-- Diff Section -->
        <div class="space-y-3">
          <h4 class="text-xs font-black text-slate-400 uppercase tracking-wider">Изменения (Diff)</h4>

          <div v-if="selectedActivity.old_data || selectedActivity.new_data" class="space-y-3">
            <!-- Old State (Было) -->
            <div v-if="selectedActivity.old_data" class="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 space-y-1.5">
              <div class="text-[10px] font-black text-rose-700 uppercase tracking-wider flex items-center gap-1">
                <span>🔴</span>
                <span>Было (Old State)</span>
              </div>
              <pre class="text-xs font-mono text-rose-900 whitespace-pre-wrap">{{ JSON.stringify(selectedActivity.old_data, null, 2) }}</pre>
            </div>

            <!-- New State (Стало) -->
            <div v-if="selectedActivity.new_data" class="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 space-y-1.5">
              <div class="text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                <span>🟢</span>
                <span>Стало (New State)</span>
              </div>
              <pre class="text-xs font-mono text-emerald-900 whitespace-pre-wrap">{{ JSON.stringify(selectedActivity.new_data, null, 2) }}</pre>
            </div>
          </div>

          <div v-else class="bg-slate-50 p-4 rounded-2xl text-xs text-slate-500 text-center">
            Нет дополнительных параметров изменений для этой операции.
          </div>
        </div>

        <!-- Close Button -->
        <button
          @click="selectedActivity = null"
          class="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all"
        >
          Закрыть
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import api from '../../api';

export default {
  name: 'CarrierActivity',
  props: {
    user: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      activities: [],
      loading: false,
      selectedPeriod: 'all',
      searchTimeout: null,
      filters: {
        entity_id: '',
        entity_type: '',
        action: '',
        from: '',
        to: ''
      },
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 1
      },
      selectedActivity: null
    };
  },
  mounted() {
    this.fetchActivity(1);
  },
  methods: {
    async fetchActivity(page = 1) {
      this.loading = true;
      this.pagination.page = page;

      try {
        const params = {
          page: this.pagination.page,
          limit: this.pagination.limit
        };

        if (this.filters.entity_id) params.entity_id = this.filters.entity_id.trim();
        if (this.filters.entity_type) params.entity_type = this.filters.entity_type;
        if (this.filters.action) params.action = this.filters.action;
        if (this.filters.from) params.from = this.filters.from;
        if (this.filters.to) params.to = this.filters.to;

        const res = await api.get('/bus-admin/activity', { params });
        this.activities = res.data?.activity || [];
        this.pagination = res.data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 };
      } catch (err) {
        console.error('[CarrierActivity] Failed to fetch activity logs:', err);
      } finally {
        this.loading = false;
      }
    },

    onSearchInput() {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.fetchActivity(1);
      }, 300);
    },

    onPeriodChange() {
      const now = new Date();
      if (this.selectedPeriod === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        this.filters.from = startOfDay;
        this.filters.to = '';
      } else if (this.selectedPeriod === '7days') {
        const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        this.filters.from = past7;
        this.filters.to = '';
      } else if (this.selectedPeriod === '30days') {
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        this.filters.from = past30;
        this.filters.to = '';
      } else {
        this.filters.from = '';
        this.filters.to = '';
      }
      this.fetchActivity(1);
    },

    openDetails(item) {
      this.selectedActivity = item;
    },

    formatDate(isoStr) {
      if (!isoStr) return '—';
      const d = new Date(isoStr);
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    formatTime(isoStr) {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    },

    getActorInitials(name) {
      if (!name) return '👤';
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.substring(0, 2).toUpperCase();
    },

    getRoleLabel(role) {
      const map = {
        owner: 'Владелец',
        dispatcher: 'Диспетчер',
        driver: 'Водитель',
        accountant: 'Бухгалтер',
        admin: 'Администратор'
      };
      return map[role] || role || 'Сотрудник';
    },

    getRoleBadgeClass(role) {
      const map = {
        owner: 'bg-amber-100 text-amber-800',
        dispatcher: 'bg-blue-100 text-blue-800',
        driver: 'bg-emerald-100 text-emerald-800',
        accountant: 'bg-purple-100 text-purple-800',
        admin: 'bg-rose-100 text-rose-800'
      };
      return map[role] || 'bg-slate-100 text-slate-700';
    },

    getActionLabel(action) {
      const map = {
        booking_created_manual: 'Создал бронь вручную',
        booking_updated: 'Изменил бронь',
        booking_cancelled: 'Отменил бронь',
        boarding_status_changed: 'Изменил посадку',
        ticket_created: 'Создал рейс',
        ticket_updated: 'Отредактировал рейс',
        ticket_duplicated: 'Дублировал рейс',
        ticket_reversed: 'Создал обратный рейс',
        ticket_deleted: 'Удалил рейс',
        member_added: 'Добавил сотрудника',
        member_role_changed: 'Изменил роль',
        member_deactivated: 'Отключил сотрудника',
        member_reactivated: 'Включил сотрудника',
        driver_assignment_changed: 'Назначил рейсы'
      };
      return map[action] || action;
    },

    getActionIcon(action) {
      const map = {
        booking_created_manual: '➕',
        booking_updated: '✏️',
        booking_cancelled: '❌',
        boarding_status_changed: '🚪',
        ticket_created: '🚌',
        ticket_updated: '📝',
        ticket_duplicated: '📋',
        ticket_reversed: '🔄',
        ticket_deleted: '🗑️',
        member_added: '👤',
        member_role_changed: '👑',
        member_deactivated: '🚫',
        member_reactivated: '✅',
        driver_assignment_changed: '🎯'
      };
      return map[action] || '📌';
    },

    getActionBadgeClass(action) {
      if (action.includes('created') || action.includes('added') || action.includes('reactivated')) {
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
      }
      if (action.includes('cancelled') || action.includes('deleted') || action.includes('deactivated')) {
        return 'bg-rose-50 text-rose-700 border border-rose-200/60';
      }
      if (action.includes('boarding')) {
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200/60';
      }
      if (action.includes('reversed') || action.includes('duplicated')) {
        return 'bg-violet-50 text-violet-700 border border-violet-200/60';
      }
      return 'bg-blue-50 text-blue-700 border border-blue-200/60';
    },

    formatDiffSummary(item) {
      const { old_data, new_data, action } = item;
      if (!new_data && !old_data) return 'Операция выполнена успешно';

      const parts = [];
      if (new_data?.seat_numbers || old_data?.seat_numbers) {
        parts.push(`Места: [${(old_data?.seat_numbers || []).join(',')}] → [${(new_data?.seat_numbers || []).join(',')}]`);
      }
      if (new_data?.boarding_status) {
        parts.push(`Посадка: ${new_data.boarding_status}`);
      }
      if (new_data?.price !== undefined) {
        parts.push(`Цена: ${new_data.price} с.`);
      }
      if (new_data?.role) {
        parts.push(`Роль: ${this.getRoleLabel(new_data.role)}`);
      }
      if (new_data?.is_active !== undefined) {
        parts.push(new_data.is_active ? 'Активен' : 'Отключен');
      }
      if (parts.length > 0) return parts.join(' • ');

      return 'Данные обновлены';
    }
  }
};
</script>
