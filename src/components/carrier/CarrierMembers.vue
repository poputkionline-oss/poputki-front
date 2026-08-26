<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-2xl lg:text-3xl font-bold text-slate-900">Команда перевозчика</h2>
        <p class="text-xs text-slate-400 mt-1 uppercase tracking-widest font-black">
          Сотрудники, роли и распределение рейсов
        </p>
      </div>

      <button
        v-if="isOwner"
        @click="openAddModal"
        class="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all"
      >
        <span class="text-lg leading-none">+</span>
        <span>Добавить сотрудника</span>
      </button>
    </div>

    <!-- Owner Banner -->
    <div v-if="owner" class="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 rounded-3xl border border-amber-500/20 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl font-black shadow-md shadow-amber-500/20">
          👑
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="font-black text-slate-900 text-base">{{ owner.name || 'Владелец компании' }}</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white uppercase tracking-wider">
              Владелец
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-0.5 font-mono">{{ owner.phone }} • Полный доступ ко всем функциям</p>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && members.length === 0" class="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm space-y-3">
      <div class="text-4xl">👥</div>
      <h3 class="text-lg font-bold text-slate-900">Сотрудники пока не добавлены</h3>
      <p class="text-xs text-slate-400 max-w-md mx-auto">
        Добавьте диспетчеров для управления бронированиями, водителей для проведения посадки или бухгалтера для просмотра финансовых отчетов.
      </p>
      <button
        v-if="isOwner"
        @click="openAddModal"
        class="mt-2 px-5 py-2.5 rounded-xl bg-amber-50 text-amber-700 font-bold text-xs hover:bg-amber-100 transition-all inline-flex items-center gap-1.5"
      >
        <span>+ Добавить первого сотрудника</span>
      </button>
    </div>

    <!-- Members Table (Desktop) -->
    <div v-else-if="!loading" class="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hidden md:block">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
              <th class="px-6 py-4">Сотрудник</th>
              <th class="px-6 py-4">Роль</th>
              <th class="px-6 py-4">Статус</th>
              <th class="px-6 py-4">Назначенные рейсы</th>
              <th class="px-6 py-4 text-right">Действия</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50 text-xs">
            <tr v-for="m in members" :key="m.id" class="hover:bg-slate-50/40 transition-colors">
              <!-- Name & Phone -->
              <td class="px-6 py-4">
                <div class="font-bold text-slate-900 text-sm">{{ m.name }}</div>
                <div class="text-[11px] text-slate-400 font-mono mt-0.5">{{ m.phone }}</div>
              </td>

              <!-- Role Badge -->
              <td class="px-6 py-4">
                <span 
                  :class="getRoleBadgeClass(m.role)"
                  class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider inline-block"
                >
                  {{ getRoleLabel(m.role) }}
                </span>
              </td>

              <!-- Status Badge -->
              <td class="px-6 py-4">
                <span 
                  :class="m.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'"
                  class="px-2.5 py-0.5 rounded-full text-[10px] font-black inline-block"
                >
                  {{ m.is_active ? '✓ Активен' : '✕ Отключен' }}
                </span>
              </td>

              <!-- Assigned Trips -->
              <td class="px-6 py-4">
                <div v-if="m.role === 'driver'" class="space-y-1">
                  <div v-if="getAssignedTickets(m.assigned_ticket_ids).length > 0" class="flex flex-wrap gap-1">
                    <span 
                      v-for="t in getAssignedTickets(m.assigned_ticket_ids)" 
                      :key="t.id"
                      class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold"
                    >
                      🚌 {{ t.from_city }} → {{ t.to_city }} ({{ t.departure_date }})
                    </span>
                  </div>
                  <span v-else class="text-slate-400 italic text-[11px]">Рейсы не назначены</span>
                  <div>
                    <button 
                      v-if="isOwner"
                      @click="openAssignModal(m)"
                      class="text-[10px] text-amber-600 font-bold hover:underline"
                    >
                      ✎ Назначить рейсы
                    </button>
                  </div>
                </div>
                <div v-else class="text-slate-400 text-[11px]">
                  {{ m.role === 'dispatcher' ? 'Все рейсы компании' : (m.role === 'accountant' ? 'Финансовые отчеты' : '—') }}
                </div>
              </td>

              <!-- Actions -->
              <td class="px-6 py-4 text-right">
                <div class="inline-flex items-center gap-2" v-if="isOwner">
                  <button 
                    @click="openEditModal(m)" 
                    class="p-2 text-slate-400 hover:text-amber-500 rounded-xl hover:bg-slate-100 transition-colors"
                    title="Редактировать роль"
                  >
                    ✎
                  </button>
                  <button 
                    @click="toggleStatus(m)" 
                    :class="m.is_active ? 'text-amber-600 hover:text-amber-700 bg-amber-50' : 'text-emerald-600 hover:text-emerald-700 bg-emerald-50'"
                    class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors"
                    :title="m.is_active ? 'Отключить доступ' : 'Активировать доступ'"
                  >
                    {{ m.is_active ? 'Отключить' : 'Включить' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Mobile Cards View (<= 768px) -->
    <div v-if="!loading && members.length > 0" class="md:hidden space-y-3">
      <div 
        v-for="m in members" 
        :key="`mob_${m.id}`"
        class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-bold text-slate-900 text-sm">{{ m.name }}</div>
            <div class="text-[11px] text-slate-400 font-mono mt-0.5">{{ m.phone }}</div>
          </div>
          <span 
            :class="m.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'"
            class="px-2 py-0.5 rounded-full text-[10px] font-black shrink-0"
          >
            {{ m.is_active ? '✓ Активен' : '✕ Отключен' }}
          </span>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-slate-50 text-xs">
          <div>
            <span class="text-[10px] text-slate-400 uppercase block font-bold">Роль</span>
            <span 
              :class="getRoleBadgeClass(m.role)"
              class="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase mt-0.5 inline-block"
            >
              {{ getRoleLabel(m.role) }}
            </span>
          </div>

          <div v-if="m.role === 'driver'" class="text-right">
            <span class="text-[10px] text-slate-400 uppercase block font-bold">Рейсы</span>
            <span class="font-bold text-slate-900 text-[11px]">
              {{ (m.assigned_ticket_ids || []).length }} назначено
            </span>
          </div>
        </div>

        <div v-if="isOwner" class="pt-2 border-t border-slate-50 flex items-center justify-end gap-2">
          <button 
            v-if="m.role === 'driver'"
            @click="openAssignModal(m)"
            class="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 font-bold text-xs"
          >
            🚌 Рейсы
          </button>
          <button 
            @click="openEditModal(m)"
            class="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
          >
            ✎ Изменить
          </button>
          <button 
            @click="toggleStatus(m)"
            :class="m.is_active ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'"
            class="px-3 py-1.5 rounded-xl font-bold text-xs"
          >
            {{ m.is_active ? 'Отключить' : 'Включить' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Add Member Modal -->
    <div v-if="showAddModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-xl font-black text-slate-900">Добавить сотрудника</h3>
            <p class="text-xs text-slate-400 mt-0.5">Сотрудник должен быть зарегистрирован в POPUTKI.ONLINE</p>
          </div>
          <button @click="showAddModal = false" class="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100">✕</button>
        </div>

        <form @submit.prevent="submitAddMember" class="space-y-4">
          <!-- Phone -->
          <div>
            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Номер телефона *</label>
            <input 
              v-model="form.phone" 
              type="text" 
              placeholder="+992900000000" 
              required
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-amber-500"
            />
            <p class="text-[11px] text-slate-400 mt-1">
              Укажите телефон, под которым сотрудник зарегистрирован в сервисе.
            </p>
          </div>

          <!-- Role -->
          <div>
            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Роль сотрудника *</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                @click="form.role = 'dispatcher'"
                :class="form.role === 'dispatcher' ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-50 text-slate-700 border border-slate-200'"
                class="py-3 px-2 rounded-2xl text-xs font-bold transition-all text-center"
              >
                <div>🎧 Диспетчер</div>
                <div class="text-[9px] font-normal opacity-80 mt-0.5">Рейсы & Брони</div>
              </button>

              <button
                type="button"
                @click="form.role = 'driver'"
                :class="form.role === 'driver' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 text-slate-700 border border-slate-200'"
                class="py-3 px-2 rounded-2xl text-xs font-bold transition-all text-center"
              >
                <div>🚌 Водитель</div>
                <div class="text-[9px] font-normal opacity-80 mt-0.5">Посадка пассажиров</div>
              </button>

              <button
                type="button"
                @click="form.role = 'accountant'"
                :class="form.role === 'accountant' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-50 text-slate-700 border border-slate-200'"
                class="py-3 px-2 rounded-2xl text-xs font-bold transition-all text-center"
              >
                <div>📊 Бухгалтер</div>
                <div class="text-[9px] font-normal opacity-80 mt-0.5">Финансы read-only</div>
              </button>
            </div>
          </div>

          <!-- Driver Trips Selector -->
          <div v-if="form.role === 'driver'" class="space-y-2 pt-2 border-t border-slate-100">
            <label class="block text-xs font-bold uppercase text-slate-500">Назначить рейсы водителю</label>
            <div class="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-100">
              <label 
                v-for="t in tickets" 
                :key="t.id"
                class="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-100 text-xs font-medium text-slate-800 cursor-pointer hover:bg-amber-50/50"
              >
                <input 
                  type="checkbox" 
                  :value="t.id" 
                  v-model="form.assigned_ticket_ids" 
                  class="rounded text-amber-500 focus:ring-amber-400"
                />
                <span class="truncate">🚌 {{ t.from_city }} → {{ t.to_city }} ({{ t.departure_date }})</span>
              </label>
            </div>
          </div>

          <div class="pt-4 flex items-center justify-end gap-3">
            <button 
              type="button" 
              @click="showAddModal = false"
              class="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
            >
              Отмена
            </button>
            <button 
              type="submit"
              :disabled="saving"
              class="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all"
            >
              {{ saving ? 'Сохранение...' : 'Добавить в команду' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Member / Assign Trips Modal -->
    <div v-if="showEditModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-xl font-black text-slate-900">Редактировать сотрудника</h3>
            <p class="text-xs text-slate-400 mt-0.5">{{ editingMember?.name }} ({{ editingMember?.phone }})</p>
          </div>
          <button @click="showEditModal = false" class="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100">✕</button>
        </div>

        <form @submit.prevent="submitEditMember" class="space-y-4">
          <!-- Role -->
          <div>
            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Роль сотрудника</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                @click="editForm.role = 'dispatcher'"
                :class="editForm.role === 'dispatcher' ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-50 text-slate-700 border border-slate-200'"
                class="py-3 px-2 rounded-2xl text-xs font-bold transition-all text-center"
              >
                <div>🎧 Диспетчер</div>
              </button>

              <button
                type="button"
                @click="editForm.role = 'driver'"
                :class="editForm.role === 'driver' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 text-slate-700 border border-slate-200'"
                class="py-3 px-2 rounded-2xl text-xs font-bold transition-all text-center"
              >
                <div>🚌 Водитель</div>
              </button>

              <button
                type="button"
                @click="editForm.role = 'accountant'"
                :class="editForm.role === 'accountant' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-50 text-slate-700 border border-slate-200'"
                class="py-3 px-2 rounded-2xl text-xs font-bold transition-all text-center"
              >
                <div>📊 Бухгалтер</div>
              </button>
            </div>
          </div>

          <!-- Driver Trips Selector -->
          <div v-if="editForm.role === 'driver'" class="space-y-2 pt-2 border-t border-slate-100">
            <label class="block text-xs font-bold uppercase text-slate-500">Назначенные рейсы</label>
            <div class="max-h-52 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-100">
              <label 
                v-for="t in tickets" 
                :key="t.id"
                class="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-100 text-xs font-medium text-slate-800 cursor-pointer hover:bg-amber-50/50"
              >
                <input 
                  type="checkbox" 
                  :value="t.id" 
                  v-model="editForm.assigned_ticket_ids" 
                  class="rounded text-amber-500 focus:ring-amber-400"
                />
                <span class="truncate">🚌 {{ t.from_city }} → {{ t.to_city }} ({{ t.departure_date }})</span>
              </label>
            </div>
          </div>

          <div class="pt-4 flex items-center justify-end gap-3">
            <button 
              type="button" 
              @click="showEditModal = false"
              class="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
            >
              Отмена
            </button>
            <button 
              type="submit"
              :disabled="saving"
              class="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all"
            >
              {{ saving ? 'Сохранение...' : 'Сохранить изменения' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import api from '../../api';

export default {
  name: 'CarrierMembers',
  props: {
    user: {
      type: Object,
      required: true
    },
    tickets: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      members: [],
      owner: null,
      loading: false,
      saving: false,
      showAddModal: false,
      showEditModal: false,
      editingMember: null,
      form: {
        phone: '',
        role: 'dispatcher',
        assigned_ticket_ids: []
      },
      editForm: {
        role: 'dispatcher',
        assigned_ticket_ids: []
      }
    };
  },
  computed: {
    isOwner() {
      return this.user?.memberRole === 'owner' || this.user?.role === 'bus_driver';
    }
  },
  mounted() {
    this.fetchMembers();
  },
  methods: {
    async fetchMembers() {
      this.loading = true;
      try {
        const { data } = await api.get('/bus-admin/members');
        this.owner = data.owner || null;
        this.members = data.members || [];
      } catch (err) {
        console.error('[CarrierMembers] Error fetching team:', err);
      } finally {
        this.loading = false;
      }
    },
    getRoleLabel(role) {
      switch (role) {
        case 'dispatcher': return 'Диспетчер';
        case 'driver': return 'Водитель';
        case 'accountant': return 'Бухгалтер';
        case 'owner': return 'Владелец';
        default: return role;
      }
    },
    getRoleBadgeClass(role) {
      switch (role) {
        case 'dispatcher': return 'bg-indigo-100 text-indigo-800 border border-indigo-200/50';
        case 'driver': return 'bg-amber-100 text-amber-800 border border-amber-200/50';
        case 'accountant': return 'bg-emerald-100 text-emerald-800 border border-emerald-200/50';
        case 'owner': return 'bg-purple-100 text-purple-800 border border-purple-200/50';
        default: return 'bg-slate-100 text-slate-800';
      }
    },
    getAssignedTickets(ticketIds) {
      if (!Array.isArray(ticketIds) || ticketIds.length === 0) return [];
      return this.tickets.filter(t => ticketIds.includes(t.id));
    },
    openAddModal() {
      this.form = {
        phone: '',
        role: 'dispatcher',
        assigned_ticket_ids: []
      };
      this.showAddModal = true;
    },
    async submitAddMember() {
      this.saving = true;
      try {
        await api.post('/bus-admin/members', {
          phone: this.form.phone,
          role: this.form.role,
          assigned_ticket_ids: this.form.assigned_ticket_ids
        });
        this.showAddModal = false;
        alert('Сотрудник успешно добавлен в команду');
        await this.fetchMembers();
      } catch (err) {
        const errData = err.response?.data;
        if (errData?.code === 'USER_NOT_REGISTERED') {
          alert('Пользователь с таким номером еще не зарегистрирован в системе.\n\nПопросите сотрудника сначала пройти регистрацию на сайте или в Telegram-боте POPUTKI.ONLINE, после чего добавьте его в команду.');
        } else {
          alert(errData?.error || 'Ошибка при добавлении сотрудника');
        }
      } finally {
        this.saving = false;
      }
    },
    openEditModal(member) {
      this.editingMember = member;
      this.editForm = {
        role: member.role || 'dispatcher',
        assigned_ticket_ids: Array.isArray(member.assigned_ticket_ids) ? [...member.assigned_ticket_ids] : []
      };
      this.showEditModal = true;
    },
    openAssignModal(member) {
      this.openEditModal(member);
    },
    async submitEditMember() {
      if (!this.editingMember) return;
      this.saving = true;
      try {
        await api.patch(`/bus-admin/members/${this.editingMember.id}`, this.editForm);
        this.showEditModal = false;
        alert('Данные сотрудника обновлены');
        await this.fetchMembers();
      } catch (err) {
        alert(err.response?.data?.error || 'Ошибка обновления данных');
      } finally {
        this.saving = false;
      }
    },
    async toggleStatus(member) {
      const newStatus = !member.is_active;
      const confirmText = newStatus 
        ? `Активировать доступ для сотрудника ${member.name}?` 
        : `Отключить доступ сотруднику ${member.name}? Сотрудник сразу потеряет доступ к кабинету.`;
      
      if (!confirm(confirmText)) return;

      try {
        await api.patch(`/bus-admin/members/${member.id}/status`, { is_active: newStatus });
        member.is_active = newStatus;
      } catch (err) {
        alert(err.response?.data?.error || 'Ошибка изменения статуса');
      }
    }
  }
};
</script>
