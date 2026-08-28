<template>
    <div class="space-y-6">
        <!-- Header & Top Stats -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h2 class="text-2xl lg:text-3xl font-bold text-slate-900">База клиентов (CRM)</h2>
                <p class="text-xs text-slate-400 mt-1 uppercase tracking-widest font-black">
                    Управление пассажирами, история поездок и аналитика
                </p>
            </div>
            <div class="flex items-center gap-3">
                <button 
                    @click="exportToExcel" 
                    :disabled="exportLoading || customers.length === 0"
                    class="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2"
                >
                    <svg v-if="!exportLoading" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span v-else class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                    <span>{{ exportLoading ? 'Экспорт...' : 'Экспорт в Excel' }}</span>
                </button>
            </div>
        </div>

        <!-- Summary KPI Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Всего клиентов</p>
                <h3 class="text-2xl font-black text-slate-900">{{ summary.total_customers || 0 }}</h3>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-amber-500">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Постоянных</p>
                <h3 class="text-2xl font-black text-amber-500">{{ summary.repeat_customers || 0 }}</h3>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-emerald-500">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Выручка клиентов</p>
                <h3 class="text-2xl font-black text-emerald-500">{{ formatMoney(summary.total_revenue) }} <span class="text-xs">с.</span></h3>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-l-4 border-rose-500">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Неявок (No-show)</p>
                <h3 class="text-2xl font-black text-rose-500">{{ summary.total_no_shows || 0 }}</h3>
            </div>
        </div>

        <!-- Filters & Search Toolbar -->
        <div class="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <!-- Search Input -->
                <div class="relative lg:col-span-2">
                    <input 
                        v-model="searchQuery" 
                        @input="handleSearchInput"
                        placeholder="Поиск по ФИО, телефону или номеру документа..." 
                        class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none focus:border-amber-500 focus:bg-white text-slate-900 transition-all shadow-inner"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <button 
                        v-if="searchQuery" 
                        @click="clearSearch" 
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Source Filter -->
                <div>
                    <select 
                        v-model="selectedSource" 
                        @change="fetchCustomers(1)" 
                        class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-bold outline-none focus:border-amber-500"
                    >
                        <option value="all">Все источники</option>
                        <option value="web">Сайт</option>
                        <option value="telegram">Telegram</option>
                        <option value="manual">Ручные брони</option>
                        <option value="direct_link">Прямые ссылки</option>
                        <option value="partner_link">Партнеры</option>
                    </select>
                </div>

                <!-- Loyalty Filter -->
                <div>
                    <select 
                        v-model="selectedLoyalty" 
                        @change="fetchCustomers(1)" 
                        class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-bold outline-none focus:border-amber-500"
                    >
                        <option value="all">Все категории лояльности</option>
                        <option value="new">Новые (1 поездка)</option>
                        <option value="repeat">Повторные (2–4 поездки)</option>
                        <option value="regular">Постоянные (5+ поездок)</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Loading Skeleton -->
        <div v-if="loading && customers.length === 0 && !loadError" class="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm space-y-4 animate-pulse">
            <div v-for="i in 5" :key="i" class="h-12 bg-slate-50 rounded-xl"></div>
        </div>

        <!-- Error State (Do not mask as 0 customers) -->
        <div v-else-if="loadError" class="bg-white rounded-3xl border border-rose-100 p-12 text-center shadow-sm">
            <div class="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
                ⚠️
            </div>
            <h4 class="text-base font-bold text-slate-800 mb-1">Не удалось загрузить базу клиентов</h4>
            <p class="text-xs text-rose-500 max-w-md mx-auto mb-6">{{ loadError }}</p>
            <button 
                @click="fetchCustomers(pagination.page || 1)" 
                class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-500/20 transition-all inline-flex items-center gap-1.5"
            >
                <span>🔄</span>
                <span>Повторить</span>
            </button>
        </div>

        <!-- Empty State (Only shown when successful empty response) -->
        <div v-else-if="!loading && customers.length === 0" class="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
            <div class="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            </div>
            <h4 class="text-base font-bold text-slate-800 mb-1">Клиенты не найдены</h4>
            <p class="text-xs text-slate-400">Попробуйте изменить поисковый запрос или сбросить фильтры</p>
        </div>

        <!-- Desktop Table View -->
        <div v-else class="hidden lg:block bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                        <tr class="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100">
                            <th class="px-6 py-4">Клиент</th>
                            <th class="px-6 py-4">Контакты</th>
                            <th class="px-6 py-4">Документ</th>
                            <th class="px-6 py-4 text-center">Поездок</th>
                            <th class="px-6 py-4">Последний рейс</th>
                            <th class="px-6 py-4">Сумма броней</th>
                            <th class="px-6 py-4 text-center">Надежность</th>
                            <th class="px-6 py-4 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50">
                        <tr v-for="c in customers" :key="c.customer_key" class="hover:bg-slate-50/40 transition-colors">
                            <!-- Name & Loyalty Badge -->
                            <td class="px-6 py-4">
                                <div class="font-bold text-slate-900 text-sm flex items-center gap-2">
                                    <span>{{ customerDisplayName(c) }}</span>
                                </div>
                                <div v-if="customerSubTitle(c)" class="text-[11px] text-slate-400 font-medium mt-0.5">
                                    {{ customerSubTitle(c) }}
                                </div>
                                <div class="mt-1 flex items-center gap-1.5">
                                    <span 
                                        class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
                                        :class="loyaltyBadgeClass(c.loyalty_badge)"
                                    >
                                        {{ loyaltyBadgeLabel(c.loyalty_badge) }}
                                    </span>
                                    <span class="text-[10px] text-slate-400 font-mono">{{ formatSource(c.primary_source) }}</span>
                                </div>
                            </td>

                            <!-- Phone & Direct Actions -->
                            <td class="px-6 py-4">
                                <div class="font-bold text-slate-900 text-xs font-mono">{{ c.phone }}</div>
                                <div class="flex items-center gap-2 mt-1.5" v-if="c.phone && c.phone !== '—'">
                                    <a :href="'tel:' + c.phone" class="text-[10px] text-amber-600 hover:text-amber-700 font-bold flex items-center gap-0.5">
                                        <span>📞</span> Позвонить
                                    </a>
                                    <span class="text-slate-200">•</span>
                                    <a :href="whatsappLink(c.phone)" target="_blank" class="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-0.5">
                                        <span>💬</span> WA
                                    </a>
                                </div>
                            </td>

                            <!-- Document -->
                            <td class="px-6 py-4">
                                <div v-if="c.has_document" class="text-xs text-slate-700 font-medium">
                                    <span class="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                                        <span>✓</span> Паспорт внесён
                                    </span>
                                </div>
                                <div v-else class="text-slate-300 text-xs">—</div>
                            </td>

                            <!-- Trips -->
                            <td class="px-6 py-4 text-center">
                                <div class="text-sm font-black text-slate-900">{{ c.total_trips }}</div>
                                <div class="text-[10px] text-slate-400 font-medium">
                                    <span class="text-emerald-600 font-bold">{{ c.confirmed_trips }} подтв.</span>
                                    <span v-if="c.future_trips > 0" class="text-sky-600 font-bold block">{{ c.future_trips }} предст.</span>
                                </div>
                            </td>

                            <!-- Last Trip -->
                            <td class="px-6 py-4">
                                <div v-if="c.last_trip" class="text-xs">
                                    <div class="font-bold text-slate-800">{{ c.last_trip.from_city }} → {{ c.last_trip.to_city }}</div>
                                    <div class="text-[10px] text-slate-400 font-mono mt-0.5">{{ c.last_trip.date }}</div>
                                </div>
                                <div v-else class="text-slate-300 text-xs">—</div>
                            </td>

                            <!-- Total Revenue -->
                            <td class="px-6 py-4">
                                <div class="font-black text-slate-900 text-sm">{{ formatMoney(c.total_booking_value) }} <span class="text-xs">с.</span></div>
                                <div v-if="c.cancelled_count > 0" class="text-[10px] text-rose-500 font-bold">{{ c.cancelled_count }} отмен</div>
                            </td>

                            <!-- Reliability / Warning -->
                            <td class="px-6 py-4 text-center">
                                <span 
                                    v-if="c.has_no_show_warning" 
                                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-100"
                                    title="Пассажир не явился на рейс ранее"
                                >
                                    ⚠️ {{ c.no_show_count }} неявок
                                </span>
                                <span v-else class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600">
                                    ✓ Надежный
                                </span>
                            </td>

                            <!-- Action Buttons -->
                            <td class="px-6 py-4 text-right">
                                <div class="flex items-center justify-end gap-2">
                                    <button 
                                        @click="openCustomerDetails(c.customer_key)"
                                        class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                                    >
                                        Карточка
                                    </button>
                                    <button 
                                        v-if="!isAnonymousCustomer(c)"
                                        @click="quickRebook(c)"
                                        class="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 text-xs font-bold rounded-xl transition-all border border-amber-200 flex items-center gap-1"
                                        title="Быстро создать бронь"
                                    >
                                        <span>+</span> Бронь
                                    </button>
                                    <button 
                                        v-else
                                        disabled
                                        class="px-3 py-1.5 bg-slate-50 text-slate-300 text-xs font-bold rounded-xl border border-slate-100 cursor-not-allowed"
                                        title="Недоступно: нет данных пассажира"
                                    >
                                        <span>+</span> Бронь
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Mobile Card View -->
        <div class="lg:hidden space-y-4">
            <div 
                v-for="c in customers" 
                :key="'mob-' + c.customer_key"
                class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4"
            >
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-bold text-slate-900 text-base">{{ customerDisplayName(c) }}</h4>
                        <p v-if="customerSubTitle(c)" class="text-[11px] text-slate-400 font-medium">{{ customerSubTitle(c) }}</p>
                        <p class="text-xs text-slate-500 font-mono mt-0.5">{{ c.phone }}</p>
                    </div>
                    <span 
                        class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider"
                        :class="loyaltyBadgeClass(c.loyalty_badge)"
                    >
                        {{ loyaltyBadgeLabel(c.loyalty_badge) }}
                    </span>
                </div>

                <div class="grid grid-cols-2 gap-3 py-3 border-y border-slate-50 text-xs">
                    <div>
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Поездок</span>
                        <span class="font-black text-slate-900">{{ c.total_trips }} ({{ c.confirmed_trips }} подтв.)</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Сумма</span>
                        <span class="font-black text-slate-900">{{ formatMoney(c.total_booking_value) }} с.</span>
                    </div>
                    <div v-if="c.last_trip" class="col-span-2">
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Последний рейс</span>
                        <span class="text-slate-800 font-bold">{{ c.last_trip.from_city }} → {{ c.last_trip.to_city }} ({{ c.last_trip.date }})</span>
                    </div>
                    <div v-if="c.has_no_show_warning" class="col-span-2">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-100">
                            ⚠️ Зафиксировано {{ c.no_show_count }} неявок
                        </span>
                    </div>
                </div>

                <div class="flex items-center justify-between gap-2 pt-1">
                    <div class="flex items-center gap-2">
                        <a v-if="c.phone && c.phone !== '—'" :href="'tel:' + c.phone" class="p-2.5 bg-slate-100 rounded-xl text-slate-700 text-xs font-bold">📞</a>
                        <a v-if="c.phone && c.phone !== '—'" :href="whatsappLink(c.phone)" target="_blank" class="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold">💬</a>
                    </div>
                    <div class="flex items-center gap-2">
                        <button @click="openCustomerDetails(c.customer_key)" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">
                            Карточка
                        </button>
                        <button 
                            v-if="!isAnonymousCustomer(c)" 
                            @click="quickRebook(c)" 
                            class="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20"
                        >
                            + Бронь
                        </button>
                        <button 
                            v-else 
                            disabled 
                            class="px-4 py-2 bg-slate-100 text-slate-300 rounded-xl text-xs font-bold cursor-not-allowed"
                        >
                            + Бронь
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Pagination Controls -->
        <div v-if="pagination.totalPages > 1" class="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div class="text-xs text-slate-400 font-medium">
                Показано <span class="font-bold text-slate-800">{{ customers.length }}</span> из <span class="font-bold text-slate-800">{{ pagination.total }}</span> клиентов
            </div>
            <div class="flex items-center gap-2">
                <button 
                    @click="fetchCustomers(pagination.page - 1)" 
                    :disabled="pagination.page <= 1"
                    class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl text-xs font-bold transition-all"
                >
                    ← Назад
                </button>
                <span class="text-xs font-bold text-slate-700 px-2">
                    {{ pagination.page }} / {{ pagination.totalPages }}
                </span>
                <button 
                    @click="fetchCustomers(pagination.page + 1)" 
                    :disabled="pagination.page >= pagination.totalPages"
                    class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl text-xs font-bold transition-all"
                >
                    Вперед →
                </button>
            </div>
        </div>

        <!-- Customer Details Modal -->
        <div v-if="showModal && selectedCustomerDetails" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div class="bg-white rounded-[32px] max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden relative">
                <!-- Modal Header -->
                <div class="p-6 md:p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                    <div>
                        <div class="flex items-center gap-2.5">
                            <h3 class="text-xl md:text-2xl font-black text-slate-900">{{ selectedCustomerDetails.profile.name }}</h3>
                            <span 
                                class="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider"
                                :class="loyaltyBadgeClass(selectedCustomerDetails.profile.loyalty_badge)"
                            >
                                {{ loyaltyBadgeLabel(selectedCustomerDetails.profile.loyalty_badge) }}
                            </span>
                        </div>
                        <p class="text-xs text-slate-500 font-mono mt-1 flex items-center gap-2">
                            <span>{{ selectedCustomerDetails.profile.phone }}</span>
                            <span v-if="selectedCustomerDetails.profile.phone !== '—'" class="text-slate-300">•</span>
                            <span v-if="selectedCustomerDetails.profile.phone !== '—'" class="text-amber-600 font-sans font-bold">{{ formatSource(selectedCustomerDetails.profile.primary_source) }}</span>
                        </p>
                    </div>
                    <button @click="showModal = false" class="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Modal Body (Scrollable) -->
                <div class="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
                    <!-- Warning Banner -->
                    <div v-if="selectedCustomerDetails.profile.has_no_show_warning" class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5">
                        <span>⚠️</span>
                        <span>Внимание: пассажир не явился на посадку {{ selectedCustomerDetails.statistics.no_show_count }} раз(а).</span>
                    </div>

                    <!-- Statistics Grid -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                            <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Всего поездок</span>
                            <span class="text-xl font-black text-slate-900">{{ selectedCustomerDetails.statistics.total_trips }}</span>
                        </div>
                        <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                            <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Подтверждено</span>
                            <span class="text-xl font-black text-emerald-600">{{ selectedCustomerDetails.statistics.confirmed_trips }}</span>
                        </div>
                        <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                            <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Отменено</span>
                            <span class="text-xl font-black text-rose-500">{{ selectedCustomerDetails.statistics.cancelled_count }}</span>
                        </div>
                        <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                            <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Выручка</span>
                            <span class="text-xl font-black text-slate-900">{{ formatMoney(selectedCustomerDetails.statistics.total_booking_value) }} <span class="text-xs">с.</span></span>
                        </div>
                    </div>

                    <!-- Document Details -->
                    <div v-if="selectedCustomerDetails.profile.document" class="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-2">
                        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Паспортные данные</h4>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                            <div>
                                <span class="text-[10px] text-slate-400 block">Тип документа</span>
                                <span class="font-bold text-slate-800">{{ selectedCustomerDetails.profile.document.docType || 'Паспорт' }}</span>
                            </div>
                            <div>
                                <span class="text-[10px] text-slate-400 block">Номер документа</span>
                                <span class="font-mono font-bold text-slate-900">{{ selectedCustomerDetails.profile.document.docNumber }}</span>
                            </div>
                            <div>
                                <span class="text-[10px] text-slate-400 block">Гражданство</span>
                                <span class="font-bold text-slate-800">{{ selectedCustomerDetails.profile.document.citizenship || '—' }}</span>
                            </div>
                            <div>
                                <span class="text-[10px] text-slate-400 block">Дата рождения</span>
                                <span class="font-mono text-slate-800">{{ selectedCustomerDetails.profile.document.birthDate || '—' }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Upcoming Bookings -->
                    <div v-if="selectedCustomerDetails.future_bookings && selectedCustomerDetails.future_bookings.length > 0" class="space-y-3">
                        <h4 class="text-xs font-bold text-sky-600 uppercase tracking-widest">Предстоящие поездки</h4>
                        <div class="space-y-2">
                            <div 
                                v-for="fb in selectedCustomerDetails.future_bookings" 
                                :key="'fut-' + fb.booking_id"
                                class="p-4 rounded-2xl bg-sky-50/50 border border-sky-100 flex justify-between items-center"
                            >
                                <div>
                                    <div class="font-bold text-slate-900 text-sm">{{ fb.from_city }} → {{ fb.to_city }}</div>
                                    <div class="text-xs text-slate-500 font-mono mt-0.5">{{ fb.departure_date }} в {{ fb.departure_time || '08:00' }}</div>
                                </div>
                                <div class="text-right">
                                    <span 
                                        class="px-2.5 py-1 text-[10px] font-black rounded-lg uppercase"
                                        :class="fb.status === 'pending_payment' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-700'"
                                    >
                                        {{ fb.status === 'pending_payment' ? 'Ожидает оплаты' : (fb.boarding_status === 'boarded' ? 'Посажен' : (fb.boarding_status === 'no_show' ? 'Не явился' : 'Ожидает посадки')) }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Trip History -->
                    <div class="space-y-3">
                        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest">История поездок</h4>
                        <div v-if="selectedCustomerDetails.trip_history.length === 0" class="text-slate-400 text-xs text-center py-4">
                            Нет завершенных поездок
                        </div>
                        <div v-else class="space-y-2">
                            <div 
                                v-for="th in selectedCustomerDetails.trip_history" 
                                :key="'hist-' + th.booking_id"
                                class="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-2"
                            >
                                <div>
                                    <div class="font-bold text-slate-900 text-sm">{{ th.from_city }} → {{ th.to_city }}</div>
                                    <div class="text-xs text-slate-400 font-mono mt-0.5">
                                        {{ th.departure_date || '—' }} • Места: {{ (th.seat_numbers || []).join(', ') || '—' }}
                                    </div>
                                </div>
                                <div class="flex items-center gap-3">
                                    <span 
                                        class="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase"
                                        :class="th.status === 'pending_payment' ? 'bg-amber-50 text-amber-700' : (th.boarding_status === 'no_show' ? 'bg-rose-50 text-rose-600' : (th.boarding_status === 'boarded' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'))"
                                    >
                                        {{ th.status === 'pending_payment' ? 'Ожидает оплаты' : (th.boarding_status === 'no_show' ? 'Не явился' : (th.boarding_status === 'boarded' ? 'Посажен' : (th.status === 'confirmed' ? 'Совершена' : th.status))) }}
                                    </span>

                                    <span class="font-black text-slate-900 text-sm font-mono">{{ th.total_price }} с.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- Modal Footer -->
                <div class="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <button @click="showModal = false" class="px-6 py-3 bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-300 transition-all">
                        Закрыть
                    </button>
                    <button @click="quickRebookFromModal" class="px-6 py-3 bg-amber-500 text-slate-900 rounded-2xl text-xs font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 hover:text-white transition-all flex items-center gap-2">
                        <span>+</span>
                        <span>Создать новую бронь для клиента</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import api from '../../api';
import { exportCrmCustomersExcel } from '../../utils/excelExport';

export default {
    name: 'CarrierCustomers',
    props: {
        user: {
            type: Object,
            default: () => ({})
        }
    },
    emits: ['quick-rebook'],
    data() {
        return {
            loading: false,
            loadError: null,
            exportLoading: false,
            customers: [],
            pagination: {
                page: 1,
                limit: 50,
                total: 0,
                totalPages: 1
            },
            summary: {
                total_customers: 0,
                repeat_customers: 0,
                total_no_shows: 0,
                total_revenue: 0
            },
            searchQuery: '',
            searchTimeout: null,
            selectedSource: 'all',
            selectedLoyalty: 'all',
            showModal: false,
            selectedCustomerDetails: null
        };
    },
    async mounted() {
        await this.fetchCustomers(1);
    },
    methods: {
        async fetchCustomers(page = 1) {
            this.loading = true;
            this.loadError = null;
            try {
                const params = new URLSearchParams();
                params.append('page', page);
                params.append('limit', this.pagination.limit);

                if (this.searchQuery && this.searchQuery.trim()) {
                    params.append('search', this.searchQuery.trim());
                }
                if (this.selectedSource && this.selectedSource !== 'all') {
                    params.append('source', this.selectedSource);
                }
                if (this.selectedLoyalty && this.selectedLoyalty !== 'all') {
                    params.append('loyalty', this.selectedLoyalty);
                }

                const res = await api.get(`/bus-admin/customers?${params.toString()}`);
                if (res && res.data) {
                    this.customers = res.data.customers || [];
                    this.pagination = res.data.pagination || this.pagination;
                    this.summary = res.data.summary || this.summary;
                }
            } catch (err) {
                console.error('[CarrierCustomers] Error loading CRM customers:', err);
                this.loadError = err.response?.data?.error || 'Не удалось загрузить базу клиентов';
            } finally {
                this.loading = false;
            }
        },

        handleSearchInput() {
            if (this.searchTimeout) clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.fetchCustomers(1);
            }, 300);
        },

        clearSearch() {
            this.searchQuery = '';
            this.fetchCustomers(1);
        },

        async openCustomerDetails(customerKey) {
            if (!customerKey) return;
            this.loading = true;
            try {
                const encodedKey = encodeURIComponent(customerKey);
                const res = await api.get(`/bus-admin/customers/${encodedKey}`);
                if (res && res.data) {
                    this.selectedCustomerDetails = res.data;
                    this.showModal = true;
                }
            } catch (err) {
                console.error('[CarrierCustomers] Error fetching details:', err);
                alert('Не удалось загрузить карточку клиента');
            } finally {
                this.loading = false;
            }
        },

        isAnonymousCustomer(c) {
            if (!c) return false;
            const hasName = c.name && c.name !== 'Не указано' && c.name.trim() !== '';
            const hasPhone = c.phone && c.phone !== '—' && c.phone.trim() !== '';
            const hasDoc = Boolean(c.document?.docNumber || c.has_document);
            return !hasName && !hasPhone && !hasDoc;
        },

        isPhoneOnlyCustomer(c) {
            if (!c) return false;
            const hasName = c.name && c.name !== 'Не указано' && c.name.trim() !== '';
            const hasPhone = c.phone && c.phone !== '—' && c.phone.trim() !== '';
            return !hasName && hasPhone;
        },

        customerDisplayName(c) {
            if (!c) return '—';
            if (this.isAnonymousCustomer(c)) {
                return 'Блокировка мест / Анонимная бронь';
            }
            if (this.isPhoneOnlyCustomer(c)) {
                return `Клиент ${c.phone}`;
            }
            return c.name || 'Не указано';
        },

        customerSubTitle(c) {
            if (!c) return null;
            if (this.isAnonymousCustomer(c)) {
                return 'Нет данных пассажира';
            }
            if (this.isPhoneOnlyCustomer(c)) {
                return 'ФИО не указано';
            }
            return null;
        },

        async quickRebook(customer) {
            if (!customer || this.isAnonymousCustomer(customer)) return;

            let profile = customer;
            // If document details are missing but customer_key is available, fetch details from backend
            if (customer.customer_key && (!customer.document || !customer.document.docNumber)) {
                this.loading = true;
                try {
                    const encodedKey = encodeURIComponent(customer.customer_key);
                    const res = await api.get(`/bus-admin/customers/${encodedKey}`);
                    if (res && res.data && res.data.profile) {
                        profile = {
                            ...customer,
                            name: res.data.profile.name || customer.name,
                            phone: res.data.profile.phone || customer.phone,
                            document: res.data.profile.document || customer.document
                        };
                    }
                } catch (err) {
                    console.warn('[CarrierCustomers] Could not fetch details for quick rebook, using basic data:', err);
                } finally {
                    this.loading = false;
                }
            }

            const doc = profile.document || {};
            const rawName = (profile.name && profile.name !== 'Не указано') ? profile.name.trim() : '';
            const nameParts = rawName ? rawName.split(/\s+/) : [];

            const rebookPayload = {
                passenger_name: rawName,
                phone: (profile.phone && profile.phone !== '—') ? profile.phone : '',
                passengers_data: [
                    {
                        lastName: doc.lastName || nameParts[0] || '',
                        firstName: doc.firstName || nameParts[1] || rawName || '',
                        middleName: doc.middleName || nameParts.slice(2).join(' ') || '',
                        docType: doc.docType || 'Загранпаспорт',
                        docNumber: doc.docNumber || '',
                        citizenship: doc.citizenship || 'Таджикистан',
                        birthDate: doc.birthDate || '',
                        gender: doc.gender || 'male',
                        phone: (profile.phone && profile.phone !== '—') ? profile.phone : '',
                        seatNumber: ''
                    }
                ]
            };
            this.$emit('quick-rebook', rebookPayload);
        },

        quickRebookFromModal() {
            if (!this.selectedCustomerDetails || !this.selectedCustomerDetails.profile) return;
            const c = this.selectedCustomerDetails.profile;
            this.showModal = false;
            this.quickRebook({
                name: c.name,
                phone: c.phone,
                document: c.document,
                customer_key: this.selectedCustomerDetails.customer_key
            });
        },

        async exportToExcel() {
            this.exportLoading = true;
            try {
                // Fetch full unpaginated list for export
                const res = await api.get('/bus-admin/customers?limit=1000');
                const list = (res && res.data && res.data.customers) ? res.data.customers : this.customers;
                await exportCrmCustomersExcel(list);
            } catch (err) {
                console.error('[CarrierCustomers] Export error:', err);
                alert('Ошибка при выгрузке Excel');
            } finally {
                this.exportLoading = false;
            }
        },

        loyaltyBadgeClass(badge) {
            switch (badge) {
                case 'regular': return 'bg-amber-100 text-amber-800 border border-amber-200';
                case 'repeat': return 'bg-sky-100 text-sky-800 border border-sky-200';
                default: return 'bg-slate-100 text-slate-600 border border-slate-200';
            }
        },

        loyaltyBadgeLabel(badge) {
            switch (badge) {
                case 'regular': return '★ Постоянный';
                case 'repeat': return 'Повторный';
                default: return 'Новый';
            }
        },

        formatSource(src) {
            const map = {
                web: 'Сайт',
                telegram: 'Telegram',
                manual: 'Ручная бронь',
                direct_link: 'Ссылка',
                partner_link: 'Партнер'
            };
            return map[src] || src || 'Сайт';
        },

        formatMoney(val) {
            return Number(val || 0).toLocaleString('ru-RU');
        },

        whatsappLink(phone) {
            if (!phone) return '#';
            const clean = phone.replace(/[^\d]/g, '');
            return `https://wa.me/${clean}`;
        }
    }
};
</script>
