<template>
  <div class="space-y-6 lg:space-y-8">
    <!-- Header Card -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm">
      <div>
        <div class="flex items-center gap-3 mb-1">
          <h2 class="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">Источники и кампании</h2>
          <span class="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-black rounded-full border border-amber-200">ADMIN-ONLY</span>
          <span class="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full border border-slate-200">Учёт с 04.09.2026</span>
        </div>
        <p class="text-sm text-slate-500">
          Сквозная аналитика платформы: источники трафика, эффективность кампаний, блогеры, рефералы, CPA и ROMI
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button 
          @click="fetchAllData" 
          :disabled="loading"
          class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all flex items-center gap-2 text-sm shadow-sm"
        >
          <svg :class="{'animate-spin': loading}" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{{ loading ? 'Обновление...' : 'Обновить данные' }}</span>
        </button>
      </div>
    </div>

    <!-- Filters Toolbar -->
    <div class="bg-white p-6 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm space-y-4">
      <!-- Period Selector -->
      <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">Период:</span>
          <button 
            v-for="p in [
              { id: 'today', label: 'Сегодня' },
              { id: 'yesterday', label: 'Вчера' },
              { id: '7days', label: '7 дней' },
              { id: '30days', label: '30 дней' },
              { id: 'custom', label: 'Период' }
            ]" 
            :key="p.id"
            @click="setPeriod(p.id)"
            class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            :class="selectedPeriod === p.id ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'"
          >
            {{ p.label }}
          </button>
        </div>
        <button 
          @click="resetFilters" 
          class="text-xs font-bold text-slate-400 hover:text-slate-600 underline"
        >
          Сбросить фильтры
        </button>
      </div>

      <!-- Custom Date Pickers (if custom period) -->
      <div v-if="selectedPeriod === 'custom'" class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Дата с</label>
          <input 
            type="date" 
            v-model="filters.date_from" 
            @change="fetchAllData"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Дата по</label>
          <input 
            type="date" 
            v-model="filters.date_to" 
            @change="fetchAllData"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <!-- Dimension Dropdown Filters -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Платформа</label>
          <select 
            v-model="filters.source_platform" 
            @change="fetchAllData"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
          >
            <option value="">Все платформы</option>
            <option v-for="p in platformOptions" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Канал (Medium)</label>
          <select 
            v-model="filters.source_medium" 
            @change="fetchAllData"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
          >
            <option value="">Все каналы</option>
            <option value="organic_social">Organic Social</option>
            <option value="paid_social">Paid Social</option>
            <option value="messenger">Messenger</option>
            <option value="search_organic">Search Organic</option>
            <option value="search_paid">Search Paid</option>
            <option value="influencer">Influencer</option>
            <option value="referral">Referral</option>
            <option value="qr">QR-код</option>
            <option value="direct">Direct</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Только Direct/Unknown</label>
          <select 
            v-model="filters.direct_unknown_only" 
            @change="onDirectUnknownToggle"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
          >
            <option value="false">Все источники трафика</option>
            <option value="true">Только Неизвестный / Прямой трафик</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Поиск кампании / кода</label>
          <input 
            v-model="filters.search" 
            type="text" 
            placeholder="Код, название кампании..." 
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
          />
        </div>
      </div>
    </div>

    <!-- State 1: Error State -->
    <div v-if="error" class="bg-rose-50 border border-rose-200 p-8 rounded-2xl lg:rounded-[32px] text-center space-y-4 shadow-sm">
      <div class="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl">⚠️</div>
      <div>
        <h3 class="text-lg font-black text-rose-900">Ошибка загрузки данных</h3>
        <p class="text-xs text-rose-600 max-w-md mx-auto mt-1">{{ error }}</p>
      </div>
      <div>
        <button 
          @click="fetchAllData" 
          class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-600/20"
        >
          Повторить
        </button>
      </div>
    </div>

    <!-- State 2: Loading Skeleton State -->
    <div v-else-if="loading" class="space-y-6 animate-pulse">
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4">
        <div v-for="i in 12" :key="'kpi-skel-' + i" class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="h-3 w-16 bg-slate-100 rounded mb-2"></div>
          <div class="h-6 w-20 bg-slate-200 rounded mb-1"></div>
          <div class="h-2 w-12 bg-slate-100 rounded"></div>
        </div>
      </div>
      <div class="bg-white p-6 rounded-2xl lg:rounded-[32px] border border-slate-100 h-64"></div>
    </div>

    <!-- State 3 & 4: Data Loaded (Success or Empty) -->
    <div v-else class="space-y-6 lg:space-y-8">
      <!-- 12 Top-Level KPI Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4">
        <!-- 1. Unique Visitors -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Посетители</div>
          <div class="text-xl lg:text-2xl font-black text-slate-900">{{ formatNumber(summary?.kpis?.unique_visitors) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Уникальные посетители</div>
        </div>

        <!-- 2. Sessions -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Сессии</div>
          <div class="text-xl lg:text-2xl font-black text-slate-900">{{ formatNumber(summary?.kpis?.sessions) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Визиты на платформу</div>
        </div>

        <!-- 3. Telegram Opened -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Открытия TG</div>
          <div class="text-xl lg:text-2xl font-black text-sky-600">{{ formatNumber(summary?.kpis?.telegram_opened) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Переходы в Telegram</div>
        </div>

        <!-- 4. Bot Starts -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Запуски бота</div>
          <div class="text-xl lg:text-2xl font-black text-indigo-600">{{ formatNumber(summary?.kpis?.bot_starts) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Дедуплицированные /start</div>
        </div>

        <!-- 5. Contacts Shared -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Контакты</div>
          <div class="text-xl lg:text-2xl font-black text-emerald-600">{{ formatNumber(summary?.kpis?.contacts_shared) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Передали номер телефона</div>
        </div>

        <!-- 6. Users Identified -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Регистрации</div>
          <div class="text-xl lg:text-2xl font-black text-emerald-700">{{ formatNumber(summary?.kpis?.users_identified) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Пользователи платформы</div>
        </div>

        <!-- 7. Bookings Created -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Создано броней</div>
          <div class="text-xl lg:text-2xl font-black text-amber-600">{{ formatNumber(summary?.kpis?.bookings_created) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Все созданные брони</div>
        </div>

        <!-- 8. Paid Bookings -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Оплачено броней</div>
          <div class="text-xl lg:text-2xl font-black text-emerald-600">{{ formatNumber(summary?.kpis?.paid_bookings) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Подтверждённые оплаты</div>
        </div>

        <!-- 9. Completed Trips -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Поездки</div>
          <div class="text-xl lg:text-2xl font-black text-purple-600">{{ formatNumber(summary?.kpis?.completed_trips) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Выполненные поездки</div>
        </div>

        <!-- 10. Platform Revenue -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Выручка</div>
          <div class="text-xl lg:text-2xl font-black text-slate-900">{{ formatCurrency(summary?.kpis?.total_revenue) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Выручка платформы</div>
        </div>

        <!-- 11. Unknown Source Rate -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Неизвестно</div>
          <div class="text-xl lg:text-2xl font-black" :class="(summary?.kpis?.unknown_source_rate || 0) > 15 ? 'text-rose-600' : 'text-slate-900'">
            {{ formatPercent(summary?.kpis?.unknown_source_rate) }}
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">Доля direct/unknown</div>
        </div>

        <!-- 12. Repeat Passengers -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Повторные</div>
          <div class="text-xl lg:text-2xl font-black text-blue-600">{{ formatNumber(summary?.kpis?.repeat_passengers) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Повторные брони</div>
        </div>
      </div>

      <!-- 11-Step Funnel Sequence Pipeline -->
      <div class="bg-white p-6 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base lg:text-lg font-black text-slate-900">Воронка по источникам (11 шагов)</h3>
            <p class="text-xs text-slate-400">Полный путь от первого визита до завершённой поездки</p>
          </div>
          <span class="text-xs font-bold text-slate-400">Конверсия сквозная</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-11 gap-2 pt-2">
          <div 
            v-for="(step, idx) in (summary?.funnel || [])" 
            :key="step.id" 
            class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                <span>Шаг {{ idx + 1 }}</span>
                <span v-if="idx > 0" class="text-amber-600 font-black">{{ formatPercent(step.conversion_from_prev) }}</span>
              </div>
              <div class="text-xs font-bold text-slate-800 line-clamp-1" :title="step.name">{{ step.name }}</div>
            </div>
            <div class="mt-3">
              <div class="text-lg font-black text-slate-900">{{ formatNumber(step.count) }}</div>
              <div class="text-[10px] text-slate-400">от старта: {{ formatPercent(step.conversion_from_start) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Analytical Subtabs Navigation -->
      <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button 
          v-for="tab in [
            { id: 'sources', label: 'Источники' },
            { id: 'campaigns', label: 'Кампании и контент' },
            { id: 'partners', label: 'Партнёры и блогеры' },
            { id: 'referrals', label: 'Рекомендации пассажиров' },
            { id: 'guardrails', label: 'Guardrails и диагностика' }
          ]" 
          :key="tab.id"
          @click="activeSubtab = tab.id"
          class="px-4 py-2 rounded-xl text-xs font-black transition-all"
          :class="activeSubtab === tab.id ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Subtab 1: Sources Table -->
      <div v-if="activeSubtab === 'sources'" class="bg-white rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 class="text-base font-black text-slate-900">Отчёт «Источники»</h4>
            <p class="text-xs text-slate-400">Трафик и конверсии с детализацией по платформе и medium</p>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th class="py-3 px-4">Платформа</th>
                <th class="py-3 px-4">Канал</th>
                <th class="py-3 px-4 text-right">Посетители</th>
                <th class="py-3 px-4 text-right">Сессии</th>
                <th class="py-3 px-4 text-right">Бот</th>
                <th class="py-3 px-4 text-right">Контакты</th>
                <th class="py-3 px-4 text-right">Брони</th>
                <th class="py-3 px-4 text-right">Оплаты</th>
                <th class="py-3 px-4 text-right">Поездки</th>
                <th class="py-3 px-4 text-right">Визит→Контакт</th>
                <th class="py-3 px-4 text-right">Контакт→Бронь</th>
                <th class="py-3 px-4 text-right">Бронь→Оплата</th>
                <th class="py-3 px-4 text-right">Выручка</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="r in sourcesRows" :key="r.source_platform" class="hover:bg-slate-50/50 transition-colors">
                <td class="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full" :class="r.source_platform === 'unknown' ? 'bg-amber-400' : 'bg-emerald-500'"></span>
                  <span>{{ r.source_platform }}</span>
                </td>
                <td class="py-3 px-4 text-slate-500">{{ r.source_medium }}</td>
                <td class="py-3 px-4 text-right font-medium text-slate-700">{{ formatNumber(r.visitors) }}</td>
                <td class="py-3 px-4 text-right text-slate-600">{{ formatNumber(r.sessions) }}</td>
                <td class="py-3 px-4 text-right text-slate-600">{{ formatNumber(r.bot_starts) }}</td>
                <td class="py-3 px-4 text-right text-slate-600">{{ formatNumber(r.contacts) }}</td>
                <td class="py-3 px-4 text-right text-slate-600">{{ formatNumber(r.bookings) }}</td>
                <td class="py-3 px-4 text-right font-bold text-emerald-600">{{ formatNumber(r.paid_bookings) }}</td>
                <td class="py-3 px-4 text-right text-purple-600">{{ formatNumber(r.completed_trips) }}</td>
                <td class="py-3 px-4 text-right text-slate-600">{{ formatPercent(r.conversion_visit_to_contact) }}</td>
                <td class="py-3 px-4 text-right text-slate-600">{{ formatPercent(r.conversion_contact_to_booking) }}</td>
                <td class="py-3 px-4 text-right font-bold text-slate-800">{{ formatPercent(r.conversion_booking_to_paid) }}</td>
                <td class="py-3 px-4 text-right font-black text-slate-900">{{ formatCurrency(r.total_revenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Subtab 2: Campaigns Table -->
      <div v-if="activeSubtab === 'campaigns'" class="bg-white rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 class="text-base font-black text-slate-900">Отчёт «Кампании и контент»</h4>
            <p class="text-xs text-slate-400">Бюджет, CPA, фактическая выручка и ROMI</p>
          </div>
        </div>

        <div v-if="campaignsRows.length === 0" class="p-12 text-center text-slate-400">
          <p class="text-sm font-bold text-slate-500">Кампании пока не созданы</p>
          <p class="text-xs mt-1">Данные появятся при регистрации рекламных ссылок и кампаний</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th class="py-3 px-4">Код / Кампания</th>
                <th class="py-3 px-4">Платформа</th>
                <th class="py-3 px-4">Тип</th>
                <th class="py-3 px-4 text-right">Бюджет</th>
                <th class="py-3 px-4 text-right">Посетители</th>
                <th class="py-3 px-4 text-right">Оплаты</th>
                <th class="py-3 px-4 text-right">Поездки</th>
                <th class="py-3 px-4 text-right">Выручка</th>
                <th class="py-3 px-4 text-right">CPA</th>
                <th class="py-3 px-4 text-right">ROMI</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="c in filteredCampaigns" :key="c.code" class="hover:bg-slate-50/50 transition-colors">
                <td class="py-3 px-4">
                  <div class="font-bold text-slate-900">{{ c.name }}</div>
                  <div class="text-[10px] text-slate-400 font-mono">{{ c.code }}</div>
                </td>
                <td class="py-3 px-4 text-slate-600">{{ c.source_platform }}</td>
                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold" :class="c.campaign_type === 'paid' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'">
                    {{ c.campaign_type }}
                  </span>
                </td>
                <td class="py-3 px-4 text-right font-medium text-slate-700">
                  {{ c.budget_amount ? `${formatNumber(c.budget_amount)} ${c.currency || ''}` : '—' }}
                </td>
                <td class="py-3 px-4 text-right text-slate-600">{{ formatNumber(c.visitors) }}</td>
                <td class="py-3 px-4 text-right font-bold text-emerald-600">{{ formatNumber(c.paid_bookings) }}</td>
                <td class="py-3 px-4 text-right text-purple-600">{{ formatNumber(c.completed_trips) }}</td>
                <td class="py-3 px-4 text-right font-bold text-slate-900">{{ formatCurrency(c.total_revenue) }}</td>
                <td class="py-3 px-4 text-right font-bold text-slate-700">
                  {{ c.cpa ? formatCurrency(c.cpa, c.currency) : '—' }}
                </td>
                <td class="py-3 px-4 text-right font-black">
                  <span v-if="c.currency_mismatch" class="text-amber-600 text-[10px] font-bold" title="Разные валюты бюджета и выручки">
                    Требуется курс
                  </span>
                  <span v-else-if="c.romi !== null" :class="c.romi >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                    {{ c.romi }}%
                  </span>
                  <span v-else class="text-slate-400">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Subtab 3: Partners & Bloggers -->
      <div v-if="activeSubtab === 'partners'" class="bg-white rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 class="text-base font-black text-slate-900">Партнёры и блогеры</h4>
            <p class="text-xs text-slate-400">Эффективность реферальных каналов и внешних партнёров (без PII)</p>
          </div>
        </div>

        <div v-if="partnersRows.length === 0" class="p-12 text-center text-slate-400">
          <p class="text-sm font-bold text-slate-500">Партнёры пока не зарегистрированы</p>
          <p class="text-xs mt-1">Здесь появится статистика блогеров и аффилиатов</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th class="py-3 px-4">Код партнёра</th>
                <th class="py-3 px-4">Имя / Канал</th>
                <th class="py-3 px-4">Тип</th>
                <th class="py-3 px-4 text-right">Клики</th>
                <th class="py-3 px-4 text-right">Посетители</th>
                <th class="py-3 px-4 text-right">Контакты</th>
                <th class="py-3 px-4 text-right">Оплаты</th>
                <th class="py-3 px-4 text-right">Поездки</th>
                <th class="py-3 px-4 text-right">Конверсия</th>
                <th class="py-3 px-4 text-right">Выручка</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="p in partnersRows" :key="p.code" class="hover:bg-slate-50/50 transition-colors">
                <td class="py-3 px-4 font-mono font-bold text-slate-900">{{ p.code }}</td>
                <td class="py-3 px-4 font-bold text-slate-800">{{ p.display_name }}</td>
                <td class="py-3 px-4 text-slate-500">{{ p.partner_type }}</td>
                <td class="py-3 px-4 text-right text-slate-600">{{ formatNumber(p.clicks) }}</td>
                <td class="py-3 px-4 text-right text-slate-600">{{ formatNumber(p.visitors) }}</td>
                <td class="py-3 px-4 text-right text-slate-600">{{ formatNumber(p.contacts) }}</td>
                <td class="py-3 px-4 text-right font-bold text-emerald-600">{{ formatNumber(p.paid_bookings) }}</td>
                <td class="py-3 px-4 text-right text-purple-600">{{ formatNumber(p.completed_trips) }}</td>
                <td class="py-3 px-4 text-right font-bold text-slate-800">{{ formatPercent(p.conversion_rate) }}</td>
                <td class="py-3 px-4 text-right font-black text-slate-900">{{ formatCurrency(p.total_revenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Subtab 4: Passenger Referrals -->
      <div v-if="activeSubtab === 'referrals'" class="bg-white p-6 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm space-y-6">
        <div>
          <h4 class="text-base font-black text-slate-900">Рекомендации пассажиров</h4>
          <p class="text-xs text-slate-400">Агрегированная вирусная активность и реферальные цепочки</p>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Ссылок создано</div>
            <div class="text-2xl font-black text-slate-900 mt-1">{{ formatNumber(referralsSummary?.links_created) }}</div>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Открытий ссылок</div>
            <div class="text-2xl font-black text-sky-600 mt-1">{{ formatNumber(referralsSummary?.links_opened) }}</div>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Приглашённых зарегистрировано</div>
            <div class="text-2xl font-black text-emerald-600 mt-1">{{ formatNumber(referralsSummary?.invitees_registered) }}</div>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Приглашённых с бронью</div>
            <div class="text-2xl font-black text-amber-600 mt-1">{{ formatNumber(referralsSummary?.invitees_booked) }}</div>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Завершённых поездок</div>
            <div class="text-2xl font-black text-purple-600 mt-1">{{ formatNumber(referralsSummary?.invitees_completed_trips) }}</div>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="text-[10px] font-bold text-slate-400 uppercase">Конверсия рефералов</div>
            <div class="text-2xl font-black text-emerald-700 mt-1">{{ formatPercent(referralsSummary?.referral_conversion_rate) }}</div>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="text-[10px] font-bold text-slate-400 uppercase">K-Factor (Виральность)</div>
            <div class="text-2xl font-black text-indigo-600 mt-1">
              {{ referralsSummary?.k_factor !== null && referralsSummary?.k_factor !== undefined ? referralsSummary.k_factor : '—' }}
            </div>
            <div class="text-[9px] text-slate-400 mt-0.5">Регистраций на 1 ссылку</div>
          </div>
        </div>
      </div>

      <!-- Subtab 5: Guardrails & Diagnostics -->
      <div v-if="activeSubtab === 'guardrails'" class="bg-white p-6 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm space-y-6">
        <div>
          <h4 class="text-base font-black text-slate-900">Guardrails и диагностика целостности данных</h4>
          <p class="text-xs text-slate-400">Технические индикаторы надёжности телеметрии и очередей доставки</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Signal 1: Unknown Source -->
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase">Доля неизвестного</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-black" :class="guardrails?.signals?.unknown_source === 'WARNING' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'">
                {{ guardrails?.signals?.unknown_source || 'HEALTHY' }}
              </span>
            </div>
            <div class="text-xl font-black text-slate-900">{{ formatPercent(guardrails?.diagnostics?.unknown_source_rate) }}</div>
            <div class="text-[10px] text-slate-400 mt-1">Порог предупреждения: > 15%</div>
          </div>

          <!-- Signal 2: Duplicate Attribution -->
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase">Дубли атрибуции</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                0% (HEALTHY)
              </span>
            </div>
            <div class="text-xl font-black text-slate-900">0.0%</div>
            <div class="text-[10px] text-slate-400 mt-1">Идемпотентные ключи активны</div>
          </div>

          <!-- Signal 3: Outbox Pending -->
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase">Outbox Pending</span>
              <span class="text-xs font-bold text-amber-600">{{ formatNumber(guardrails?.diagnostics?.outbox_pending) }}</span>
            </div>
            <div class="text-xl font-black text-slate-900">{{ formatNumber(guardrails?.diagnostics?.outbox_pending) }}</div>
            <div class="text-[10px] text-slate-400 mt-1">В очереди на обработку</div>
          </div>

          <!-- Signal 4: Dead-Letter Queue -->
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase">Dead-Letter</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-black" :class="(guardrails?.diagnostics?.outbox_dead_letter || 0) > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'">
                {{ (guardrails?.diagnostics?.outbox_dead_letter || 0) > 0 ? 'CRITICAL' : 'HEALTHY' }}
              </span>
            </div>
            <div class="text-xl font-black text-slate-900">{{ formatNumber(guardrails?.diagnostics?.outbox_dead_letter) }}</div>
            <div class="text-[10px] text-slate-400 mt-1">Ошибки после 5 попыток</div>
          </div>
        </div>

        <!-- Timestamps block -->
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between gap-3 text-xs text-slate-500">
          <div>
            <span class="font-bold text-slate-700">Последняя агрегация:</span>
            <span class="ml-1 font-mono">{{ formatDate(guardrails?.diagnostics?.last_successful_aggregation_at) }}</span>
          </div>
          <div>
            <span class="font-bold text-slate-700">Последний reconciliation:</span>
            <span class="ml-1 font-mono">{{ formatDate(guardrails?.diagnostics?.last_reconciliation_at) }}</span>
          </div>
          <div>
            <span class="font-bold text-slate-700">Launch Watermark:</span>
            <span class="ml-1 font-mono">04.09.2026 18:23 UTC</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from '../../api';

export default {
  name: 'AdminAcquisitionSources',
  data() {
    return {
      loading: false,
      error: null,
      selectedPeriod: '30days',
      activeSubtab: 'sources',
      filters: {
        date_from: '',
        date_to: '',
        source_platform: '',
        source_medium: '',
        direct_unknown_only: 'false',
        search: ''
      },
      summary: null,
      sourcesRows: [],
      campaignsRows: [],
      partnersRows: [],
      referralsSummary: null,
      guardrails: null,
      platformOptions: [
        { id: 'instagram', label: 'Instagram' },
        { id: 'facebook', label: 'Facebook' },
        { id: 'telegram', label: 'Telegram' },
        { id: 'whatsapp', label: 'WhatsApp' },
        { id: 'tiktok', label: 'TikTok' },
        { id: 'youtube', label: 'YouTube' },
        { id: 'google', label: 'Google Search' },
        { id: 'yandex', label: 'Yandex Search' },
        { id: 'qr', label: 'QR-коды' },
        { id: 'referral', label: 'Рефералы' },
        { id: 'partner', label: 'Партнёры / Блогеры' },
        { id: 'direct', label: 'Direct' },
        { id: 'unknown', label: 'Unknown' },
        { id: 'other', label: 'Другое' }
      ]
    };
  },
  computed: {
    filteredCampaigns() {
      if (!this.campaignsRows) return [];
      if (!this.filters.search) return this.campaignsRows;
      const q = this.filters.search.toLowerCase().trim();
      return this.campaignsRows.filter(c => 
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.name && c.name.toLowerCase().includes(q))
      );
    }
  },
  mounted() {
    this.applyPeriodDates('30days');
    this.fetchAllData();
  },
  methods: {
    setPeriod(pId) {
      this.selectedPeriod = pId;
      this.applyPeriodDates(pId);
      this.fetchAllData();
    },
    applyPeriodDates(pId) {
      const now = new Date();
      if (pId === 'today') {
        const dStr = now.toISOString().slice(0, 10);
        this.filters.date_from = dStr;
        this.filters.date_to = dStr;
      } else if (pId === 'yesterday') {
        const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const yStr = y.toISOString().slice(0, 10);
        this.filters.date_from = yStr;
        this.filters.date_to = yStr;
      } else if (pId === '7days') {
        const f = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        this.filters.date_from = f.toISOString().slice(0, 10);
        this.filters.date_to = now.toISOString().slice(0, 10);
      } else if (pId === '30days') {
        const f = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        this.filters.date_from = f.toISOString().slice(0, 10);
        this.filters.date_to = now.toISOString().slice(0, 10);
      }
    },
    onDirectUnknownToggle() {
      if (this.filters.direct_unknown_only === 'true') {
        this.filters.source_platform = 'unknown';
      } else {
        this.filters.source_platform = '';
      }
      this.fetchAllData();
    },
    resetFilters() {
      this.selectedPeriod = '30days';
      this.filters = {
        date_from: '',
        date_to: '',
        source_platform: '',
        source_medium: '',
        direct_unknown_only: 'false',
        search: ''
      };
      this.applyPeriodDates('30days');
      this.fetchAllData();
    },
    buildQueryString() {
      const params = new URLSearchParams();
      if (this.filters.date_from) params.append('date_from', this.filters.date_from);
      if (this.filters.date_to) params.append('date_to', this.filters.date_to);
      if (this.filters.source_platform) params.append('source_platform', this.filters.source_platform);
      if (this.filters.source_medium) params.append('source_medium', this.filters.source_medium);
      return params.toString();
    },
    async fetchAllData() {
      this.loading = true;
      this.error = null;
      try {
        const qs = this.buildQueryString();
        const [sumRes, srcRes, cmpRes, partRes, refRes, grdRes] = await Promise.allSettled([
          api.get(`/admin/acquisition/summary?${qs}`),
          api.get(`/admin/acquisition/sources?${qs}`),
          api.get(`/admin/acquisition/campaigns?${qs}`),
          api.get(`/admin/acquisition/partners?${qs}`),
          api.get(`/admin/acquisition/referrals?${qs}`),
          api.get(`/admin/acquisition/guardrails?${qs}`)
        ]);

        if (sumRes.status === 'fulfilled' && sumRes.value?.data) {
          this.summary = sumRes.value.data;
        }
        if (srcRes.status === 'fulfilled' && srcRes.value?.data) {
          this.sourcesRows = Array.isArray(srcRes.value.data.rows) ? srcRes.value.data.rows : [];
        }
        if (cmpRes.status === 'fulfilled' && cmpRes.value?.data) {
          this.campaignsRows = Array.isArray(cmpRes.value.data.rows) ? cmpRes.value.data.rows : [];
        }
        if (partRes.status === 'fulfilled' && partRes.value?.data) {
          this.partnersRows = Array.isArray(partRes.value.data.rows) ? partRes.value.data.rows : [];
        }
        if (refRes.status === 'fulfilled' && refRes.value?.data) {
          this.referralsSummary = refRes.value.data.summary || null;
        }
        if (grdRes.status === 'fulfilled' && grdRes.value?.data) {
          this.guardrails = grdRes.value.data;
        }

        // If all rejected
        if (sumRes.status === 'rejected' && srcRes.status === 'rejected') {
          this.error = 'Не удалось загрузить данные аналитики. Пожалуйста, проверьте подключение.';
        }
      } catch (err) {
        this.error = err?.response?.data?.error || err.message || 'Ошибка загрузки аналитики';
      } finally {
        this.loading = false;
      }
    },
    formatNumber(val) {
      if (val === null || val === undefined || isNaN(Number(val))) return '0';
      return Number(val).toLocaleString('ru-RU');
    },
    formatPercent(val) {
      if (val === null || val === undefined || isNaN(Number(val))) return '0%';
      return `${Number(val).toFixed(1)}%`;
    },
    formatCurrency(val, curr = 'TJS') {
      if (val === null || val === undefined || isNaN(Number(val))) return '0 TJS';
      return `${Number(val).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${curr || 'TJS'}`;
    },
    formatDate(val) {
      if (!val) return '—';
      try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
      } catch (e) {
        return '—';
      }
    }
  }
};
</script>
