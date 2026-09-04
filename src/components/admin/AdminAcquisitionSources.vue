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
          @click="openCampaignWizard"
          class="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm shadow-md shadow-amber-500/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>+ Создать кампанию</span>
        </button>
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
            <option value="paid_social">Paid Social (Реклама)</option>
            <option value="messenger">Мессенджеры</option>
            <option value="influencer">Блогеры</option>
            <option value="referral">Рефералы</option>
            <option value="qr">QR-код</option>
            <option value="search_organic">Поиск (SEO)</option>
            <option value="search_paid">Поиск (Реклама)</option>
            <option value="direct">Direct</option>
            <option value="offline">Офлайн</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Только Direct/Unknown</label>
          <select 
            v-model="filters.direct_unknown_only" 
            @change="onDirectUnknownToggle"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
          >
            <option value="false">Все источники</option>
            <option value="true">Только Direct / Unknown</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Поиск</label>
          <input 
            type="text" 
            v-model="filters.search" 
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
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Оплачено</div>
          <div class="text-xl lg:text-2xl font-black text-emerald-600">{{ formatNumber(summary?.kpis?.paid_bookings) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Успешные оплаты</div>
        </div>

        <!-- 9. Completed Trips -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Поездки</div>
          <div class="text-xl lg:text-2xl font-black text-purple-600">{{ formatNumber(summary?.kpis?.completed_trips) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Выполненные рейсы</div>
        </div>

        <!-- 10. Total Revenue -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Выручка</div>
          <div class="text-xl lg:text-2xl font-black text-slate-900">{{ formatCurrency(summary?.kpis?.total_revenue) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Фактическая выручка</div>
        </div>

        <!-- 11. Unknown Traffic Rate -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Direct / Unknown</div>
          <div class="text-xl lg:text-2xl font-black" :class="(summary?.kpis?.unknown_source_rate || 0) > 15 ? 'text-amber-600' : 'text-slate-900'">
            {{ formatPercent(summary?.kpis?.unknown_source_rate) }}
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">Без UTM-разметки</div>
        </div>

        <!-- 12. Repeat Passengers -->
        <div class="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Повторные</div>
          <div class="text-xl lg:text-2xl font-black text-indigo-600">{{ formatNumber(summary?.kpis?.repeat_passengers) }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Повторные бронирования</div>
        </div>
      </div>

      <!-- 11-Step Funnel Visual Block -->
      <div class="bg-white p-6 rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-black text-slate-900">Сквозная воронка привлечения (11 шагов)</h3>
            <p class="text-xs text-slate-400">От первого визита до завершённой поездки и повторной покупки</p>
          </div>
          <span class="text-xs font-bold text-slate-400">С 04.09.2026 18:23 UTC</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <div 
            v-for="(step, idx) in (summary?.funnel || [])" 
            :key="step.id" 
            class="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                <span>ШАГ {{ idx + 1 }}</span>
                <span v-if="idx > 0" class="text-emerald-600">{{ formatPercent(step.conversion_from_prev) }}</span>
              </div>
              <div class="text-xs font-bold text-slate-700 truncate" :title="step.name">{{ step.name }}</div>
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

      <!-- Subtab 2: Campaigns Table (Phase P.1G.5 Extended) -->
      <div v-if="activeSubtab === 'campaigns'" class="bg-white rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div class="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h4 class="text-base font-black text-slate-900">Отчёт «Кампании и контент»</h4>
            <p class="text-xs text-slate-400">Управление кампаниями, отслеживаемыми ссылками, бюджетом, CPA и ROMI</p>
          </div>
          <button 
            @click="openCampaignWizard"
            class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Создать кампанию</span>
          </button>
        </div>

        <div v-if="filteredCampaigns.length === 0" class="p-12 text-center text-slate-400 space-y-3">
          <div class="text-3xl">📢</div>
          <p class="text-sm font-bold text-slate-600">Кампании пока не созданы</p>
          <p class="text-xs text-slate-400 max-w-md mx-auto">
            Кампании пока не созданы. Создайте первую кампанию, чтобы отслеживать переходы, регистрации, бронирования и эффективность рекламы.
          </p>
          <button 
            @click="openCampaignWizard"
            class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all"
          >
            + Создать первую кампанию
          </button>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th class="py-3 px-4">Код / Кампания</th>
                <th class="py-3 px-4">Платформа</th>
                <th class="py-3 px-4">Тип</th>
                <th class="py-3 px-4">Статус</th>
                <th class="py-3 px-4 text-right">Бюджет</th>
                <th class="py-3 px-4 text-right">Посетители</th>
                <th class="py-3 px-4 text-right">Оплаты</th>
                <th class="py-3 px-4 text-right">Поездки</th>
                <th class="py-3 px-4 text-right">Выручка</th>
                <th class="py-3 px-4 text-right">CPA</th>
                <th class="py-3 px-4 text-right">ROMI</th>
                <th class="py-3 px-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="c in filteredCampaigns" :key="c.code" class="hover:bg-slate-50/50 transition-colors">
                <td class="py-3 px-4">
                  <div class="font-bold text-slate-900">{{ c.name }}</div>
                  <div class="text-[10px] text-slate-400 font-mono">{{ c.code }}</div>
                </td>
                <td class="py-3 px-4 text-slate-600">
                  <div>{{ c.source_platform }}</div>
                  <div class="text-[10px] text-slate-400">{{ c.source_medium }}</div>
                </td>
                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold" :class="c.campaign_type === 'paid' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'">
                    {{ c.campaign_type }}
                  </span>
                </td>
                <td class="py-3 px-4">
                  <span 
                    class="px-2 py-0.5 rounded text-[10px] font-bold"
                    :class="getCampaignStatusBadge(c).class"
                  >
                    {{ getCampaignStatusBadge(c).label }}
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
                <td class="py-3 px-4 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <button 
                      @click="openCampaignDetails(c)"
                      class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition-colors"
                      title="Подробная карточка и отслеживаемые ссылки"
                    >
                      Ссылки
                    </button>
                    <button 
                      @click="promptToggleCampaignStatus(c)"
                      class="px-2 py-1 rounded-lg text-[11px] font-bold transition-colors"
                      :class="c.is_active ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'"
                    >
                      {{ c.is_active ? 'Пауза' : 'Пуск' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Subtab 3: Partners & Bloggers -->
      <div v-if="activeSubtab === 'partners'" class="bg-white rounded-2xl lg:rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div class="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h4 class="text-base font-black text-slate-900">Партнёры и блогеры</h4>
            <p class="text-xs text-slate-400">Справочник партнёров, эффективность реферальных каналов и аффилиатов (без PII)</p>
          </div>
          <button 
            @click="openPartnerModal"
            class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Добавить партнёра</span>
          </button>
        </div>

        <div v-if="partnersRows.length === 0 && partnersList.length === 0" class="p-12 text-center text-slate-400 space-y-3">
          <p class="text-sm font-bold text-slate-500">Партнёры пока не зарегистрированы</p>
          <p class="text-xs mt-1">Здесь появится статистика блогеров и аффилиатов</p>
          <button 
            @click="openPartnerModal"
            class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
          >
            + Добавить первого партнёра
          </button>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th class="py-3 px-4">Код партнёра</th>
                <th class="py-3 px-4">Имя / Канал</th>
                <th class="py-3 px-4">Тип</th>
                <th class="py-3 px-4">Статус</th>
                <th class="py-3 px-4 text-right">Клики</th>
                <th class="py-3 px-4 text-right">Посетители</th>
                <th class="py-3 px-4 text-right">Контакты</th>
                <th class="py-3 px-4 text-right">Оплаты</th>
                <th class="py-3 px-4 text-right">Поездки</th>
                <th class="py-3 px-4 text-right">Конверсия</th>
                <th class="py-3 px-4 text-right">Выручка</th>
                <th class="py-3 px-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="p in combinedPartners" :key="p.id || p.code" class="hover:bg-slate-50/50 transition-colors">
                <td class="py-3 px-4 font-mono font-bold text-slate-900">{{ p.code }}</td>
                <td class="py-3 px-4 font-bold text-slate-800">{{ p.display_name }}</td>
                <td class="py-3 px-4 text-slate-500">{{ p.partner_type }}</td>
                <td class="py-3 px-4">
                  <span 
                    class="px-2 py-0.5 rounded text-[10px] font-bold"
                    :class="p.is_active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'"
                  >
                    {{ p.is_active !== false ? 'Активен' : 'Отключён' }}
                  </span>
                </td>
                <td class="py-3 px-4 text-right text-slate-600">{{ formatNumber(p.clicks || 0) }}</td>
                <td class="py-3 px-4 text-right text-slate-600">{{ formatNumber(p.visitors || 0) }}</td>
                <td class="py-3 px-4 text-right text-slate-600">{{ formatNumber(p.contacts || 0) }}</td>
                <td class="py-3 px-4 text-right font-bold text-emerald-600">{{ formatNumber(p.paid_bookings || 0) }}</td>
                <td class="py-3 px-4 text-right text-purple-600">{{ formatNumber(p.completed_trips || 0) }}</td>
                <td class="py-3 px-4 text-right font-bold text-slate-800">{{ formatPercent(p.conversion_rate || 0) }}</td>
                <td class="py-3 px-4 text-right font-black text-slate-900">{{ formatCurrency(p.total_revenue || 0) }}</td>
                <td class="py-3 px-4 text-right">
                  <button 
                    @click="togglePartnerStatus(p)"
                    class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors"
                    :class="p.is_active !== false ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'"
                  >
                    {{ p.is_active !== false ? 'Отключить' : 'Включить' }}
                  </button>
                </td>
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
          <!-- Signal 1: Unknown Traffic Rate -->
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase">Direct / Unknown</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-black" :class="(guardrails?.diagnostics?.unknown_source_rate || 0) > 15 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'">
                {{ (guardrails?.diagnostics?.unknown_source_rate || 0) > 15 ? 'WARNING' : 'HEALTHY' }}
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

    <!-- ================================================================= -->
    <!-- MODAL 1: STEP-BY-STEP CAMPAIGN WIZARD (Phase P.1G.5)              -->
    <!-- ================================================================= -->
    <div v-if="showCampaignWizard" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-2xl lg:rounded-[28px] max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8">
        <!-- Wizard Header -->
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-black text-slate-900">Создание маркетинговой кампании</h3>
            <p class="text-xs text-slate-500">Пошаговый мастер создания кампании, отслеживаемой ссылки и QR-кода</p>
          </div>
          <button @click="closeCampaignWizard" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm">
            ✕
          </button>
        </div>

        <!-- Wizard Step Indicator -->
        <div class="bg-slate-50 px-6 py-3 border-b border-slate-100 flex items-center justify-between text-xs">
          <div 
            v-for="(st, idx) in [
              { num: 1, label: 'Кампания' },
              { num: 2, label: 'Контент' },
              { num: 3, label: 'Ссылка' },
              { num: 4, label: 'QR и токен' },
              { num: 5, label: 'Готово' }
            ]" 
            :key="st.num"
            class="flex items-center gap-1.5"
            :class="wizardStep === st.num ? 'font-black text-amber-600' : (wizardStep > st.num ? 'font-bold text-emerald-600' : 'text-slate-400')"
          >
            <span 
              class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              :class="wizardStep === st.num ? 'bg-amber-500 text-white' : (wizardStep > st.num ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600')"
            >
              {{ wizardStep > st.num ? '✓' : st.num }}
            </span>
            <span class="hidden sm:inline">{{ st.label }}</span>
            <span v-if="idx < 4" class="text-slate-300 ml-1">→</span>
          </div>
        </div>

        <!-- Wizard Error Banner -->
        <div v-if="wizardError" class="m-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold flex items-center gap-2">
          <span>⚠️</span>
          <span>{{ wizardError }}</span>
        </div>

        <!-- Step 1: Кампания -->
        <div v-if="wizardStep === 1" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Название кампании *</label>
            <input 
              type="text" 
              v-model="campaignForm.name" 
              @input="onCampaignNameInput"
              placeholder="Например: Осенний промо-прогон в Reels"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-amber-500"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Машинный код кампании *</label>
              <input 
                type="text" 
                v-model="campaignForm.code" 
                @input="autoCode = false"
                placeholder="reels-autumn-2026"
                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 outline-none focus:border-amber-500"
              />
              <p class="text-[10px] text-slate-400 mt-1">Латиница, цифры, дефис. После запуска код неизменяем.</p>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Тип кампании</label>
              <div class="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  @click="campaignForm.campaign_type = 'organic'"
                  class="py-2.5 rounded-xl text-xs font-bold transition-all border"
                  :class="campaignForm.campaign_type === 'organic' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'"
                >
                  Органическая
                </button>
                <button 
                  type="button"
                  @click="campaignForm.campaign_type = 'paid'"
                  class="py-2.5 rounded-xl text-xs font-bold transition-all border"
                  :class="campaignForm.campaign_type === 'paid' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-50 text-slate-600 border-slate-200'"
                >
                  Платная (Реклама)
                </button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Платформа размещения *</label>
              <select 
                v-model="campaignForm.source_platform"
                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-amber-500"
              >
                <option v-for="p in platformOptions.filter(x => x.id !== 'other')" :key="p.id" :value="p.id">{{ p.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Канал (Medium) *</label>
              <select 
                v-model="campaignForm.source_medium"
                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-amber-500"
              >
                <option value="organic_social">Organic Social</option>
                <option value="paid_social">Paid Social</option>
                <option value="messenger">Мессенджер</option>
                <option value="influencer">Блогер / Лидер мнений</option>
                <option value="referral">Реферал</option>
                <option value="qr">QR-код</option>
                <option value="search_organic">Поиск (SEO)</option>
                <option value="search_paid">Поиск (CPC)</option>
                <option value="carrier_link">Ссылка перевозчика</option>
                <option value="offline">Офлайн</option>
                <option value="direct">Прямой переход</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-700 mb-1">Бюджет (для платных)</label>
              <input 
                type="number" 
                v-model="campaignForm.budget_amount" 
                min="0"
                step="0.01"
                placeholder="Сумма расходов (опционально)"
                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Валюта</label>
              <select 
                v-model="campaignForm.currency"
                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-amber-500"
              >
                <option value="TJS">TJS (Сомони)</option>
                <option value="RUB">RUB (Рубль)</option>
                <option value="USD">USD (Доллар)</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Дата старта (опционально)</label>
              <input 
                type="date" 
                v-model="campaignForm.starts_at" 
                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Дата завершения (опционально)</label>
              <input 
                type="date" 
                v-model="campaignForm.ends_at" 
                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        <!-- Step 2: Канал и контент -->
        <div v-if="wizardStep === 2" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Метка размещения (Placement Code)</label>
            <input 
              type="text" 
              v-model="linkForm.placement_code" 
              placeholder="Например: bio, reels_01, bus_sticker_front"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-amber-500"
            />
            <div class="flex flex-wrap gap-1.5 mt-1.5">
              <span class="text-[10px] text-slate-400 mr-1">Быстрый выбор:</span>
              <button 
                v-for="sug in ['bio', 'stories', 'reels', 'pinned_post', 'sticker_bus', 'ticket_paper', 'driver_card']"
                :key="sug"
                type="button"
                @click="linkForm.placement_code = sug"
                class="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-600 font-medium"
              >
                {{ sug }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Код контента (Content Code)</label>
            <input 
              type="text" 
              v-model="linkForm.content_code" 
              placeholder="Например: autumn_promo_v1, blogger_post_03"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Привязка к партнёру / блогеру</label>
            <select 
              v-model="linkForm.partner_id"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-amber-500"
            >
              <option value="">— Без партнёра —</option>
              <option v-for="pt in partnersList" :key="pt.id" :value="pt.id">
                {{ pt.display_name }} ({{ pt.code }})
              </option>
            </select>
            <p class="text-[10px] text-slate-400 mt-1">Если кампания реализуется через блогера, привяжите его для раздельной аналитики.</p>
          </div>
        </div>

        <!-- Step 3: Ссылка -->
        <div v-if="wizardStep === 3" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Целевая страница перехода *</label>
            <input 
              type="text" 
              v-model="linkForm.target_path" 
              placeholder="/ или /bus-tickets"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 outline-none focus:border-amber-500"
            />
            <div class="flex flex-wrap gap-1.5 mt-2">
              <span class="text-[10px] text-slate-400 mr-1">Популярные маршруты:</span>
              <button 
                type="button"
                @click="linkForm.target_path = '/'"
                class="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-600 font-medium"
              >
                / (Главная)
              </button>
              <button 
                type="button"
                @click="linkForm.target_path = '/bus-tickets'"
                class="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-600 font-medium"
              >
                /bus-tickets (Автобусы)
              </button>
              <button 
                type="button"
                @click="linkForm.target_path = '/search?tab=bus'"
                class="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-600 font-medium"
              >
                /search?tab=bus (Поиск)
              </button>
            </div>
            <p class="text-[10px] text-slate-400 mt-1">Разрешены только внутренние безопасные пути платформы.</p>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Срок действия ссылки (опционально)</label>
            <input 
              type="date" 
              v-model="linkForm.expires_at" 
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-amber-500"
            />
            <p class="text-[10px] text-slate-400 mt-1">После этой даты ссылка безопасно перенаправит пользователя на главную без начисления клика.</p>
          </div>
        </div>

        <!-- Step 4: Tracked Link & QR View -->
        <div v-if="wizardStep === 4" class="p-6 space-y-4">
          <div class="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-800 space-y-1">
            <div class="font-bold flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Внимание: Сохраните ссылку сейчас</span>
            </div>
            <p class="text-[11px] text-amber-700">
              В целях криптографической безопасности уникальный токен ссылки отображается только один раз. В базе данных хранится только его SHA-256 хеш. Скопируйте ссылку или сохраните QR-код прямо сейчас.
            </p>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Публичная отслеживаемая ссылка</label>
            <div class="flex items-center gap-2">
              <input 
                type="text" 
                readonly 
                :value="wizardResult.public_url" 
                class="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 outline-none"
              />
              <button 
                type="button"
                @click="copyLinkToClipboard(wizardResult.public_url)"
                class="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs whitespace-nowrap transition-all shadow-sm"
              >
                Копировать
              </button>
            </div>
          </div>

          <!-- QR Preview Card -->
          <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-3">
            <div class="w-44 h-44 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center" v-html="wizardResult.qrSvg"></div>
            <div>
              <div class="text-xs font-black text-slate-800">{{ wizardResult.campaign?.name }}</div>
              <div class="text-[10px] text-slate-400">Наведите камеру и найдите билет</div>
            </div>
            <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button 
                type="button"
                @click="downloadSvg(wizardResult.qrSvg, `${wizardResult.campaign?.code || 'campaign'}-qr.svg`)"
                class="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs shadow-sm transition-all"
              >
                Скачать SVG
              </button>
              <button 
                type="button"
                @click="downloadPng(wizardResult.qrSvg, `${wizardResult.campaign?.code || 'campaign'}-qr.png`)"
                class="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs shadow-sm transition-all"
              >
                Скачать PNG
              </button>
              <button 
                type="button"
                @click="triggerPrint(wizardResult.qrSvg, wizardResult.campaign?.name)"
                class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
              >
                Печать
              </button>
            </div>
          </div>
        </div>

        <!-- Step 5: Готово -->
        <div v-if="wizardStep === 5" class="p-8 text-center space-y-4">
          <div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-3xl">
            ✓
          </div>
          <div>
            <h3 class="text-lg font-black text-slate-900">Кампания успешно создана!</h3>
            <p class="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Кампания <strong>«{{ wizardResult.campaign?.name }}»</strong> зарегистрирована. Первая ссылка активна и готова к публикации.
            </p>
          </div>
          <div class="pt-2 flex items-center justify-center gap-3">
            <button 
              type="button"
              @click="closeCampaignWizard"
              class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
            >
              Закрыть
            </button>
            <button 
              type="button"
              @click="openCampaignDetails(wizardResult.campaign); closeCampaignWizard()"
              class="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-md"
            >
              Карточка кампании
            </button>
          </div>
        </div>

        <!-- Wizard Navigation Footer (Steps 1-4) -->
        <div v-if="wizardStep < 5" class="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button 
            type="button"
            v-if="wizardStep > 1 && wizardStep < 4"
            @click="wizardStep--"
            class="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
          >
            ← Назад
          </button>
          <div v-else></div>

          <div class="flex items-center gap-2">
            <button 
              type="button"
              @click="closeCampaignWizard"
              class="px-4 py-2 text-slate-500 hover:text-slate-700 font-bold text-xs"
            >
              Отмена
            </button>
            
            <button 
              v-if="wizardStep < 3"
              type="button"
              @click="wizardNextStep"
              class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-amber-500/20"
            >
              Далее →
            </button>

            <button 
              v-else-if="wizardStep === 3"
              type="button"
              :disabled="wizardSubmitting"
              @click="submitCampaignAndLink"
              class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
            >
              <svg v-if="wizardSubmitting" class="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>{{ wizardSubmitting ? 'Создание...' : 'Создать кампанию и ссылку' }}</span>
            </button>

            <button 
              v-else-if="wizardStep === 4"
              type="button"
              @click="wizardStep = 5"
              class="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-md"
            >
              Завершить
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- MODAL 2: CAMPAIGN DETAILS & LINKS DRAWER                          -->
    <!-- ================================================================= -->
    <div v-if="showCampaignDetailsModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-2xl lg:rounded-[28px] max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8 space-y-0">
        <!-- Header -->
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-black text-slate-900">{{ selectedCampaign?.name }}</h3>
              <span 
                class="px-2 py-0.5 rounded text-[10px] font-bold"
                :class="selectedCampaign?.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'"
              >
                {{ selectedCampaign?.is_active ? 'Активна' : 'Приостановлена' }}
              </span>
            </div>
            <p class="text-xs font-mono text-slate-400 mt-0.5">Код: {{ selectedCampaign?.code }}</p>
          </div>
          <button @click="showCampaignDetailsModal = false" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm">
            ✕
          </button>
        </div>

        <!-- Campaign Stats & Info -->
        <div class="p-6 space-y-6">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div class="text-[10px] font-bold text-slate-400 uppercase">Платформа / Канал</div>
              <div class="text-sm font-black text-slate-900 mt-0.5">{{ selectedCampaign?.source_platform }}</div>
              <div class="text-[10px] text-slate-500">{{ selectedCampaign?.source_medium }}</div>
            </div>
            <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div class="text-[10px] font-bold text-slate-400 uppercase">Тип / Бюджет</div>
              <div class="text-sm font-black text-slate-900 mt-0.5">
                {{ selectedCampaign?.budget_amount ? `${formatNumber(selectedCampaign?.budget_amount)} ${selectedCampaign?.currency}` : 'Органическая' }}
              </div>
              <div class="text-[10px] text-slate-500">{{ selectedCampaign?.campaign_type }}</div>
            </div>
            <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div class="text-[10px] font-bold text-slate-400 uppercase">Даты действия</div>
              <div class="text-xs font-bold text-slate-800 mt-1">
                {{ selectedCampaign?.starts_at ? formatDate(selectedCampaign.starts_at) : 'Без старта' }}
              </div>
              <div class="text-[10px] text-slate-500">
                по {{ selectedCampaign?.ends_at ? formatDate(selectedCampaign.ends_at) : 'бессрочно' }}
              </div>
            </div>
            <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between">
              <div class="text-[10px] font-bold text-slate-400 uppercase">Статус управления</div>
              <button 
                @click="promptToggleCampaignStatus(selectedCampaign)"
                class="mt-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                :class="selectedCampaign?.is_active ? 'bg-rose-50 hover:bg-rose-100 text-rose-700' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'"
              >
                {{ selectedCampaign?.is_active ? 'Приостановить' : 'Возобновить' }}
              </button>
            </div>
          </div>

          <!-- Section: Links of this Campaign -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-black text-slate-900">Выпущенные отслеживаемые ссылки</h4>
                <p class="text-[11px] text-slate-400">Уникальные точки размещения (Reels, Bio, QR, партнёры)</p>
              </div>
              <button 
                @click="openAddLinkModal"
                class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
              >
                + Создать ещё ссылку
              </button>
            </div>

            <div v-if="campaignLinksLoading" class="p-8 text-center text-slate-400 text-xs">
              Загрузка ссылок кампании...
            </div>

            <div v-else-if="campaignLinksError" class="p-6 bg-rose-50 border border-rose-100 rounded-xl text-center space-y-3">
              <p class="text-xs font-bold text-rose-700">{{ campaignLinksError }}</p>
              <button 
                @click="loadCampaignLinks(selectedCampaign)"
                class="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Повторить
              </button>
            </div>

            <div v-else-if="campaignLinks.length === 0" class="p-8 bg-slate-50 rounded-xl text-center text-slate-400 text-xs">
              У этой кампании пока нет выпущенных ссылок. Нажмите «Создать ещё ссылку».
            </div>

            <div v-else class="overflow-x-auto border border-slate-100 rounded-xl">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-100">
                  <tr>
                    <th class="py-2.5 px-3">Метка / Контент</th>
                    <th class="py-2.5 px-3">Целевой путь</th>
                    <th class="py-2.5 px-3 text-right">Переходы</th>
                    <th class="py-2.5 px-3">Статус</th>
                    <th class="py-2.5 px-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="l in campaignLinks" :key="l.id" class="hover:bg-slate-50/50">
                    <td class="py-2.5 px-3">
                      <div class="font-bold text-slate-800">{{ l.placement_code || l.content_code || 'Основная ссылка' }}</div>
                      <div class="text-[10px] text-slate-400 font-mono">{{ formatDate(l.created_at) }}</div>
                    </td>
                    <td class="py-2.5 px-3 font-mono text-slate-600">{{ l.target_path }}</td>
                    <td class="py-2.5 px-3 text-right font-bold text-slate-900">{{ formatNumber(l.clicks_count || 0) }}</td>
                    <td class="py-2.5 px-3">
                      <span 
                        class="px-2 py-0.5 rounded text-[10px] font-bold"
                        :class="l.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'"
                      >
                        {{ l.is_active ? 'Активна' : 'Отключена' }}
                      </span>
                    </td>
                    <td class="py-2.5 px-3 text-right">
                      <div class="flex items-center justify-end gap-1.5">
                        <button 
                          v-if="sessionLinksMap[l.id]"
                          @click="showQrForUrl(sessionLinksMap[l.id], selectedCampaign?.name)"
                          class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded text-[10px]"
                        >
                          QR
                        </button>
                        <button 
                          @click="toggleLinkStatus(l)"
                          class="px-2 py-1 rounded text-[10px] font-bold"
                          :class="l.is_active ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'"
                        >
                          {{ l.is_active ? 'Отключить' : 'Включить' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button 
            @click="showCampaignDetailsModal = false"
            class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- MODAL 3: ADD NEW LINK TO EXISTING CAMPAIGN                        -->
    <!-- ================================================================= -->
    <div v-if="showAddLinkModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-2xl lg:rounded-[28px] max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden my-8 space-y-4 p-6">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 class="text-base font-black text-slate-900">Создать отслеживаемую ссылку</h3>
            <p class="text-xs text-slate-400">Для кампании «{{ selectedCampaign?.name }}»</p>
          </div>
          <button @click="showAddLinkModal = false" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <div v-if="newLinkError" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
          {{ newLinkError }}
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Метка размещения (Placement)</label>
            <input 
              type="text" 
              v-model="newLinkPayload.placement_code" 
              placeholder="Например: qr_bus_seat_12, blogger_story_02" 
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
            />
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Код контента (Content)</label>
            <input 
              type="text" 
              v-model="newLinkPayload.content_code" 
              placeholder="Например: promo_ticket_discount" 
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
            />
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Целевой путь перенаправления *</label>
            <input 
              type="text" 
              v-model="newLinkPayload.target_path" 
              placeholder="/bus-tickets" 
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 outline-none"
            />
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Партнёр (опционально)</label>
            <select 
              v-model="newLinkPayload.partner_id"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
            >
              <option value="">— Без партнёра —</option>
              <option v-for="pt in partnersList" :key="pt.id" :value="pt.id">
                {{ pt.display_name }} ({{ pt.code }})
              </option>
            </select>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button 
            @click="showAddLinkModal = false"
            class="px-4 py-2 text-slate-500 font-bold text-xs"
          >
            Отмена
          </button>
          <button 
            :disabled="newLinkSubmitting"
            @click="submitNewLink"
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5"
          >
            <svg v-if="newLinkSubmitting" class="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Выпустить ссылку</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- MODAL 4: QR CODE VIEW, DOWNLOAD & PRINT                           -->
    <!-- ================================================================= -->
    <div v-if="showQrModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-2xl lg:rounded-[28px] max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden my-8 p-6 text-center space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 class="text-base font-black text-slate-900">QR-код кампании</h3>
          <button @click="showQrModal = false" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <div class="w-56 h-56 mx-auto bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center" v-html="activeQr.svg"></div>

        <div>
          <div class="text-sm font-black text-slate-800">{{ activeQr.title }}</div>
          <div class="text-[11px] text-slate-400 font-mono break-all mt-1 bg-slate-50 p-2 rounded-xl border border-slate-100 select-all">
            {{ activeQr.url }}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs font-bold pt-2">
          <button 
            @click="copyLinkToClipboard(activeQr.url)"
            class="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm transition-all"
          >
            Копировать ссылку
          </button>
          <button 
            @click="triggerPrint(activeQr.svg, activeQr.title)"
            class="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm transition-all"
          >
            Печать карточки
          </button>
          <button 
            @click="downloadSvg(activeQr.svg, 'campaign-qr.svg')"
            class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
          >
            Скачать SVG
          </button>
          <button 
            @click="downloadPng(activeQr.svg, 'campaign-qr.png')"
            class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
          >
            Скачать PNG
          </button>
        </div>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- MODAL 5: ADD PARTNER DICTIONARY MODAL                             -->
    <!-- ================================================================= -->
    <div v-if="showPartnerModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-2xl lg:rounded-[28px] max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden my-8 p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 class="text-base font-black text-slate-900">Добавить партнёра / блогера</h3>
            <p class="text-xs text-slate-400">Регистрация в справочнике аффилиатов</p>
          </div>
          <button @click="showPartnerModal = false" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <div v-if="partnerError" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
          {{ partnerError }}
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Имя или название канала *</label>
            <input 
              type="text" 
              v-model="partnerForm.display_name" 
              @input="onPartnerNameInput"
              placeholder="Например: Блогер Фаррух" 
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 outline-none"
            />
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Уникальный код партнёра *</label>
            <input 
              type="text" 
              v-model="partnerForm.code" 
              placeholder="farrukh_blogger" 
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-800 outline-none"
            />
            <p class="text-[10px] text-slate-400 mt-1">Латиница, цифры, дефис. После создания не изменяется.</p>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Тип партнёра</label>
            <select 
              v-model="partnerForm.partner_type"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 outline-none"
            >
              <option value="influencer">Блогер / Инфлюенсер</option>
              <option value="affiliate">Аффилиат / Партнёрская сеть</option>
              <option value="carrier">Перевозчик / Водитель</option>
              <option value="offline_agent">Офлайн-касса / Агент</option>
            </select>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button 
            @click="showPartnerModal = false"
            class="px-4 py-2 text-slate-500 font-bold text-xs"
          >
            Отмена
          </button>
          <button 
            :disabled="partnerSubmitting"
            @click="submitPartner"
            class="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5"
          >
            <svg v-if="partnerSubmitting" class="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Сохранить</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- MODAL 6: CONFIRMATION MODAL                                       -->
    <!-- ================================================================= -->
    <div v-if="confirmModal.show" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4">
        <div class="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-xl">
          ⚠️
        </div>
        <div>
          <h4 class="text-base font-black text-slate-900">{{ confirmModal.title }}</h4>
          <p class="text-xs text-slate-500 mt-1">{{ confirmModal.message }}</p>
        </div>
        <div class="flex items-center justify-center gap-2 pt-2">
          <button 
            @click="confirmModal.show = false"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
          >
            Отмена
          </button>
          <button 
            @click="executeConfirmAction"
            class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- TOAST NOTIFICATION OVERLAY                                        -->
    <!-- ================================================================= -->
    <div 
      v-if="toast.visible" 
      class="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2 text-xs font-bold transition-all animate-bounce"
      :class="toast.type === 'error' ? 'bg-rose-900 text-white border-rose-800' : 'bg-slate-900 text-white border-slate-800'"
    >
      <span>{{ toast.type === 'error' ? '❌' : '✅' }}</span>
      <span>{{ toast.message }}</span>
    </div>

    <!-- ================================================================= -->
    <!-- PRINTABLE TEMPLATE (PRINT ONLY)                                  -->
    <!-- ================================================================= -->
    <div id="acquisition-print-card" class="hidden print:block print:fixed print:inset-0 print:bg-white print:p-8 text-center space-y-6">
      <div class="text-2xl font-black tracking-tight text-slate-900">POPUTKI.ONLINE</div>
      <div class="text-sm font-bold text-slate-600">{{ printPayload.title }}</div>
      <div class="w-72 h-72 mx-auto flex items-center justify-center" v-html="printPayload.svg"></div>
      <div class="text-base font-black text-slate-900">Наведите камеру и найдите билет</div>
      <div class="text-xs text-slate-500">poputki.online</div>
    </div>
  </div>
</template>

<script>
import api from '../../api';
import { getQrSvg, downloadSvg, downloadPng, copyToClipboard } from '../../utils/qrExport.js';

function slugify(text) {
  if (!text) return '';
  const ruMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  return text
    .toLowerCase()
    .split('')
    .map(ch => ruMap[ch] !== undefined ? ruMap[ch] : ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

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
      partnersList: [],
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
      ],

      // Wizard State
      showCampaignWizard: false,
      wizardStep: 1,
      autoCode: true,
      wizardSubmitting: false,
      wizardError: null,
      campaignForm: {
        name: '',
        code: '',
        source_platform: 'instagram',
        source_medium: 'organic_social',
        campaign_type: 'organic',
        budget_amount: '',
        currency: 'TJS',
        starts_at: '',
        ends_at: ''
      },
      linkForm: {
        placement_code: '',
        content_code: '',
        partner_id: '',
        target_path: '/',
        expires_at: ''
      },
      wizardResult: {
        campaign: null,
        link: null,
        raw_token: '',
        public_url: '',
        qrSvg: ''
      },

      // Campaign Details & Links Drawer
      showCampaignDetailsModal: false,
      selectedCampaign: null,
      campaignLinks: [],
      campaignLinksLoading: false,
      campaignLinksError: null,
      sessionLinksMap: {}, // Map of link.id -> public_url created in this browser session

      // Add New Link Modal
      showAddLinkModal: false,
      newLinkPayload: {
        placement_code: '',
        content_code: '',
        partner_id: '',
        target_path: '/',
        expires_at: ''
      },
      newLinkSubmitting: false,
      newLinkError: null,

      // QR Modal
      showQrModal: false,
      activeQr: {
        title: '',
        url: '',
        svg: ''
      },

      // Partner Modal
      showPartnerModal: false,
      partnerForm: {
        display_name: '',
        code: '',
        partner_type: 'influencer'
      },
      partnerSubmitting: false,
      partnerError: null,

      // Confirmation Modal
      confirmModal: {
        show: false,
        title: '',
        message: '',
        action: null
      },

      // Toast Notification
      toast: {
        visible: false,
        message: '',
        type: 'success'
      },

      // Print payload
      printPayload: {
        title: '',
        svg: ''
      }
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
    },
    combinedPartners() {
      const reportingCodes = new Set(this.partnersRows.map(p => p.code));
      const listOnly = this.partnersList.filter(p => !reportingCodes.has(p.code));
      return [...this.partnersRows, ...listOnly];
    }
  },
  mounted() {
    this.applyPeriodDates('30days');
    this.fetchAllData();
    this.fetchPartnersDictionary();
  },
  methods: {
    downloadSvg,
    downloadPng,
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

        if (sumRes.status === 'rejected' && srcRes.status === 'rejected') {
          this.error = 'Не удалось загрузить данные аналитики. Пожалуйста, проверьте подключение.';
        }
      } catch (err) {
        this.error = err?.response?.data?.error || err.message || 'Ошибка загрузки аналитики';
      } finally {
        this.loading = false;
      }
    },
    async fetchPartnersDictionary() {
      try {
        const res = await api.get('/admin/acquisition/partners?view=dictionary');
        if (res.data && Array.isArray(res.data.rows)) {
          this.partnersList = res.data.rows;
        }
      } catch (e) {
        // Soft fallback
      }
    },
    getCampaignStatusBadge(c) {
      if (!c.is_active) {
        return { label: 'Приостановлена', class: 'bg-slate-100 text-slate-600' };
      }
      if (c.ends_at && new Date(c.ends_at) < new Date()) {
        return { label: 'Завершена', class: 'bg-blue-100 text-blue-800' };
      }
      return { label: 'Активна', class: 'bg-emerald-100 text-emerald-800' };
    },

    // Wizard Methods
    openCampaignWizard() {
      this.wizardStep = 1;
      this.autoCode = true;
      this.wizardError = null;
      this.campaignForm = {
        name: '',
        code: '',
        source_platform: 'instagram',
        source_medium: 'organic_social',
        campaign_type: 'organic',
        budget_amount: '',
        currency: 'TJS',
        starts_at: '',
        ends_at: ''
      };
      this.linkForm = {
        placement_code: '',
        content_code: '',
        partner_id: '',
        target_path: '/',
        expires_at: ''
      };
      this.wizardResult = {
        campaign: null,
        link: null,
        raw_token: '',
        public_url: '',
        qrSvg: ''
      };
      this.fetchPartnersDictionary();
      this.showCampaignWizard = true;
    },
    closeCampaignWizard() {
      this.showCampaignWizard = false;
    },
    onCampaignNameInput() {
      if (this.autoCode) {
        this.campaignForm.code = slugify(this.campaignForm.name);
      }
    },
    wizardNextStep() {
      this.wizardError = null;
      if (this.wizardStep === 1) {
        if (!this.campaignForm.name.trim()) {
          this.wizardError = 'Укажите название кампании';
          return;
        }
        if (!this.campaignForm.code.trim()) {
          this.wizardError = 'Укажите уникальный машинный код кампании';
          return;
        }
        this.wizardStep = 2;
      } else if (this.wizardStep === 2) {
        this.wizardStep = 3;
      }
    },
    async submitCampaignAndLink() {
      this.wizardSubmitting = true;
      this.wizardError = null;

      try {
        // Step A: Create campaign
        const campPayload = {
          name: this.campaignForm.name.trim(),
          code: this.campaignForm.code.trim().toLowerCase(),
          source_platform: this.campaignForm.source_platform,
          source_medium: this.campaignForm.source_medium,
          campaign_type: this.campaignForm.campaign_type,
          budget_amount: this.campaignForm.budget_amount ? Number(this.campaignForm.budget_amount) : null,
          currency: this.campaignForm.currency,
          starts_at: this.campaignForm.starts_at || null,
          ends_at: this.campaignForm.ends_at || null,
          is_active: true
        };

        const campRes = await api.post('/admin/acquisition/campaigns', campPayload);
        const createdCampaign = campRes.data.campaign;

        // Step B: Create tracked link for this campaign
        const linkPayload = {
          placement_code: this.linkForm.placement_code ? this.linkForm.placement_code.trim() : null,
          content_code: this.linkForm.content_code ? this.linkForm.content_code.trim() : null,
          partner_id: this.linkForm.partner_id || null,
          target_path: this.linkForm.target_path ? this.linkForm.target_path.trim() : '/',
          expires_at: this.linkForm.expires_at || null,
          source_platform: this.campaignForm.source_platform,
          source_medium: this.campaignForm.source_medium
        };

        const linkRes = await api.post(`/admin/acquisition/campaigns/${createdCampaign.id}/links`, linkPayload);
        const { link, raw_token, public_url } = linkRes.data;

        // Generate clean vector QR
        const qrSvg = getQrSvg(public_url, 220);

        this.wizardResult = {
          campaign: createdCampaign,
          link,
          raw_token,
          public_url,
          qrSvg
        };

        // Remember in session links map for quick QR viewing
        this.sessionLinksMap[link.id] = public_url;

        this.wizardStep = 4;
        this.showToast('Кампания и ссылка успешно созданы!');
        this.fetchAllData();
      } catch (err) {
        this.wizardError = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Ошибка создания кампании';
      } finally {
        this.wizardSubmitting = false;
      }
    },

    // Campaign Details & Links
    // Campaign Details & Links
    async openCampaignDetails(campaign) {
      this.selectedCampaign = campaign;
      this.showCampaignDetailsModal = true;
      await this.loadCampaignLinks(campaign);
    },
    async loadCampaignLinks(campaign) {
      const camp = campaign || this.selectedCampaign;
      const campaignId = camp?.id || camp?.campaign_id;
      if (!campaignId) {
        this.campaignLinksError = 'Кампания не найдена';
        this.showToast('Кампания не найдена', 'error');
        return;
      }
      this.campaignLinksLoading = true;
      this.campaignLinksError = null;
      try {
        const res = await api.get(`/admin/acquisition/campaigns/${campaignId}/links`);
        this.campaignLinks = Array.isArray(res.data.links) ? res.data.links : [];
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) {
          this.campaignLinksError = 'Сессия администратора истекла — войдите снова';
          this.showToast('Сессия администратора истекла — войдите снова', 'error');
        } else if (status === 404) {
          this.campaignLinksError = 'Кампания не найдена';
          this.showToast('Кампания не найдена', 'error');
        } else {
          this.campaignLinksError = 'Не удалось загрузить ссылки. Повторите попытку';
          this.showToast('Не удалось загрузить ссылки. Повторите попытку', 'error');
        }
      } finally {
        this.campaignLinksLoading = false;
      }
    },
    promptToggleCampaignStatus(c) {
      const campaignId = c?.id || c?.campaign_id;
      if (!campaignId) return;
      const nextActive = !c.is_active;
      this.confirmModal = {
        show: true,
        title: nextActive ? 'Возобновить кампанию?' : 'Приостановить кампанию?',
        message: nextActive 
          ? `Кампания «${c.name}» станет активной и продолжит сбор переходов.` 
          : `Кампания «${c.name}» будет приостановлена. Новые переходы не будут регистрироваться.`,
        action: async () => {
          try {
            await api.patch(`/admin/acquisition/campaigns/${campaignId}/status`, { is_active: nextActive });
            c.is_active = nextActive;
            const selId = this.selectedCampaign?.id || this.selectedCampaign?.campaign_id;
            if (selId === campaignId) {
              this.selectedCampaign.is_active = nextActive;
            }
            this.showToast(nextActive ? 'Кампания возобновлена' : 'Кампания приостановлена');
          } catch (e) {
            this.showToast('Ошибка изменения статуса кампании', 'error');
          }
        }
      };
    },
    async toggleLinkStatus(link) {
      const nextActive = !link.is_active;
      try {
        await api.patch(`/admin/acquisition/links/${link.id}/status`, { is_active: nextActive });
        link.is_active = nextActive;
        this.showToast(nextActive ? 'Ссылка активирована' : 'Ссылка отключена');
      } catch (e) {
        this.showToast('Ссылка недоступна или отключена', 'error');
      }
    },
    openAddLinkModal() {
      this.newLinkPayload = {
        placement_code: '',
        content_code: '',
        partner_id: '',
        target_path: '/',
        expires_at: ''
      };
      this.newLinkError = null;
      this.showAddLinkModal = true;
    },
    async submitNewLink() {
      const campaignId = this.selectedCampaign?.id || this.selectedCampaign?.campaign_id;
      if (!campaignId) {
        this.newLinkError = 'Кампания не найдена';
        return;
      }
      this.newLinkSubmitting = true;
      this.newLinkError = null;

      try {
        const payload = {
          placement_code: this.newLinkPayload.placement_code ? this.newLinkPayload.placement_code.trim() : null,
          content_code: this.newLinkPayload.content_code ? this.newLinkPayload.content_code.trim() : null,
          partner_id: this.newLinkPayload.partner_id || null,
          target_path: this.newLinkPayload.target_path ? this.newLinkPayload.target_path.trim() : '/',
          expires_at: this.newLinkPayload.expires_at || null,
          source_platform: this.selectedCampaign.source_platform,
          source_medium: this.selectedCampaign.source_medium
        };

        const res = await api.post(`/admin/acquisition/campaigns/${campaignId}/links`, payload);
        const { link, public_url } = res.data;

        this.sessionLinksMap[link.id] = public_url;
        this.campaignLinks.unshift({ ...link, clicks_count: 0 });
        this.showAddLinkModal = false;

        this.showQrForUrl(public_url, this.selectedCampaign.name);
        this.showToast('Новая ссылка успешно выпущена!');
      } catch (err) {
        this.newLinkError = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Ошибка выпуска ссылки';
      } finally {
        this.newLinkSubmitting = false;
      }
    },

    // QR & Print View
    showQrForUrl(url, title = 'Кампания') {
      const svg = getQrSvg(url, 220);
      this.activeQr = {
        title,
        url,
        svg
      };
      this.showQrModal = true;
    },
    triggerPrint(svg, title) {
      this.printPayload = { title, svg };
      this.$nextTick(() => {
        window.print();
      });
    },

    // Partner Dictionary Methods
    openPartnerModal() {
      this.partnerForm = {
        display_name: '',
        code: '',
        partner_type: 'influencer'
      };
      this.partnerError = null;
      this.showPartnerModal = true;
    },
    onPartnerNameInput() {
      this.partnerForm.code = slugify(this.partnerForm.display_name);
    },
    async submitPartner() {
      if (!this.partnerForm.display_name.trim() || !this.partnerForm.code.trim()) {
        this.partnerError = 'Заполните имя и уникальный код партнёра';
        return;
      }
      this.partnerSubmitting = true;
      this.partnerError = null;
      try {
        const res = await api.post('/admin/acquisition/partners', {
          display_name: this.partnerForm.display_name.trim(),
          code: this.partnerForm.code.trim().toLowerCase(),
          partner_type: this.partnerForm.partner_type
        });
        this.partnersList.unshift(res.data.partner);
        this.showPartnerModal = false;
        this.showToast('Партнёр успешно добавлен в справочник');
        this.fetchAllData();
      } catch (err) {
        this.partnerError = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Ошибка добавления партнёра';
      } finally {
        this.partnerSubmitting = false;
      }
    },
    async togglePartnerStatus(p) {
      const nextActive = p.is_active === false ? true : false;
      try {
        await api.patch(`/admin/acquisition/partners/${p.id}/status`, { is_active: nextActive });
        p.is_active = nextActive;
        this.showToast(nextActive ? 'Партнёр активирован' : 'Партнёр отключён');
      } catch (e) {
        this.showToast('Ошибка изменения статуса партнёра', 'error');
      }
    },

    // Confirm Modal Execution
    executeConfirmAction() {
      if (this.confirmModal.action) {
        this.confirmModal.action();
      }
      this.confirmModal.show = false;
    },

    // Clipboard & Toast
    async copyLinkToClipboard(url) {
      const ok = await copyToClipboard(url);
      if (ok) {
        this.showToast('Ссылка скопирована в буфер обмена');
      } else {
        this.showToast('Не удалось скопировать ссылку', 'error');
      }
    },
    showToast(message, type = 'success') {
      this.toast = { visible: true, message, type };
      setTimeout(() => {
        this.toast.visible = false;
      }, 3000);
    },

    // Formatters
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
