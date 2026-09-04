<script>
import api from '../api';
import { getTelegramUser, getTelegramInitData } from '../telegram';
import acquisitionService from '../services/acquisitionService';

// Resolves the ?tab= deep-link query param to a known tab state via an
// explicit allowlist. 'bus' (singular) is the established deep-link value
// (e.g. from the Telegram bot's Mini App button); 'buses' is the internal
// state value used throughout this component's own template. Anything else
// (missing, unrecognized) safely falls back to 'buses', never left blank.
function resolveActiveTab(queryTab) {
  if (queryTab === 'rides') return 'rides';
  return 'buses';
}

export default {
  data() {
    return {
      activeTab: resolveActiveTab(this.$route.query.tab), // 'rides' | 'buses'
      rides: [],
      busTickets: [],
      fromCity: this.$route.query.from || '',
      toCity: this.$route.query.to || '',
      date: this.$route.query.date || '',
      isLoading: true,
      showSuccessNotify: false,
      successMessage: '',
      showAltOffer: false,
      altOfferType: '', // 'rides' | 'buses'
      user: JSON.parse(localStorage.getItem('user') || 'null'),
      availableCities: [],
      amenityLabels: {
        wifi: 'Wi-Fi',
        ac: 'Кондиционер',
        usb: 'USB',
        power_220v: 'Розетки 220V',
        wc: 'Туалет',
        tv: 'Телевизор',
        kitchen: 'Мини-кухня',
        blanket: 'Одеяла',
        reclining_seats: 'Откидные кресла',
        luggage: 'Багажное отделение'
      }
    };
  },
  methods: {
    async search() {
      this.isLoading = true;
      this.showAltOffer = false;
      if (this.fromCity && this.toCity) {
        acquisitionService.trackRouteSearched({
          from_city_id: this.fromCity,
          to_city_id: this.toCity,
          travel_date: this.date
        });
      }
      try {
        const params = {};
        if (this.fromCity) params.from = this.fromCity;
        if (this.toCity) params.to = this.toCity;
        if (this.date) params.date = this.date;


        if (this.activeTab === 'rides') {
          const res = await api.get('/rides', { params });
          this.rides = res.data;
          if (this.rides.length === 0 && (this.fromCity || this.toCity || this.date)) {
            this.showAltOffer = true;
            this.altOfferType = 'buses';
          }
        } else {
          const res = await api.get('/bus-tickets', { params });
          this.busTickets = res.data;
          if (this.busTickets.length === 0 && (this.fromCity || this.toCity || this.date)) {
            this.showAltOffer = true;
            this.altOfferType = 'rides';
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        this.isLoading = false;
      }
    },
    async performAltSearch() {
      this.activeTab = this.altOfferType;
      this.showAltOffer = false;
      await this.search();
    },
    async switchTab(tab) {
      if (this.activeTab === tab) return;
      this.activeTab = tab;
      this.showAltOffer = false;
      this.fromCity = '';
      this.toCity = '';
      this.date = '';
      this.fetchCities(); // Fetch relevant cities for the new tab
      await this.search();
    },
    formatDuration(minutes) {
      if (!minutes) return '';
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h} ч. ${m > 0 ? m + ' м.' : ''}`;
    },
    formatDate(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    },
    formatHumanDate(dateStr) {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    },
    availableSeats(ticket) {
      try {
        const seats = Array.isArray(ticket.reserved_seats)
          ? ticket.reserved_seats
          : JSON.parse(ticket.reserved_seats || '[]');
        return ticket.total_seats - seats.length;
      } catch { return ticket.total_seats; }
    },
    formattedDurationFn(minutes) {
      if (!minutes) return '';
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h} ч. ${m > 0 ? m + ' м.' : ''}`;
    },
    async fetchCities() {
      try {
        const type = this.activeTab === 'buses' ? 'bus' : 'ride';
        const res = await api.get('/general/cities', { params: { type } });
        this.availableCities = res.data;
      } catch (err) {
        console.error('Failed to fetch cities:', err);
      }
    },
    parseRowPrices(rowPrices) {
      if (!rowPrices) return null;
      try {
        const parsed = typeof rowPrices === 'string' ? JSON.parse(rowPrices) : rowPrices;
        if (Object.keys(parsed).length === 0) return null;
        return parsed;
      } catch (e) {
        return null;
      }
    },
    getMinRidePrice(ride) {
      const rowPrices = this.parseRowPrices(ride.row_prices);
      if (!rowPrices) return ride.price;
      const prices = Object.values(rowPrices).filter(p => p > 0);
      if (prices.length === 0) return ride.price;
      return Math.min(...prices, ride.price);
    },
    async syncTelegram() {
      const tgUser = getTelegramUser();
      console.log("SearchResultsView: syncTelegram triggered. tgUser:", tgUser);
      if (!tgUser) return;
      
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      try {
        const payload = {
          id: tgUser.id,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name,
          username: tgUser.username,
          photo_url: tgUser.photo_url,
          userId: user?.id,
          initData: getTelegramInitData()
        };
        console.log("SearchResultsView: sending sync payload:", payload);
        const res = await api.post('/auth/telegram-login', payload);
        console.log("SearchResultsView: sync response:", res.data);

        if (res.data.user) {
          localStorage.setItem('user', JSON.stringify(res.data.user));
          if (res.data.token) localStorage.setItem('token', res.data.token);
          this.user = res.data.user;
        }
      } catch (e) {
        console.error("SearchResultsView: Sync TG error:", e);
      }
    }
  },
  mounted() {
    acquisitionService.initSession();

    // Check for success notification from redirect
    if (this.$route.query.success === 'true') {
      this.successMessage = this.$route.query.message || 'Операция выполнена!';
      this.showSuccessNotify = true;
      setTimeout(() => {
        this.showSuccessNotify = false;
        this.$router.replace({ query: {} });
      }, 4000);
    }
    Promise.all([
      this.fetchCities(),
      this.search(),
      this.syncTelegram()
    ]);
  }
};
</script>

<template>
  <div class="bg-slate-50 min-h-screen">
    <!-- Success Notification -->
    <Transition name="fade">
      <div v-if="showSuccessNotify" class="fixed top-6 left-6 right-6 z-[100] bg-green-500 text-white p-4 rounded-2xl shadow-2xl flex items-center space-x-3 border border-green-400/20 backdrop-blur-md">
        <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div class="flex-1">
          <div class="font-bold">Успешно!</div>
          <div class="text-sm opacity-90">{{ successMessage }}</div>
        </div>
        <button @click="showSuccessNotify = false" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- Header — dynamic color based on tab -->
    <div
      class="p-6 pt-12 rounded-b-[40px] shadow-xl relative z-10 overflow-hidden transition-all duration-500"
      :class="activeTab === 'rides'
        ? 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-amber-500/20'
        : 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-indigo-500/20'"
    >
      <!-- Decorational Circles -->
      <div class="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/20 rounded-full blur-2xl"></div>
      <div class="absolute bottom-0 left-0 -ml-10 -mb-5 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>

      <!-- Tab Switcher -->
      <div class="flex gap-2 mb-5 relative z-10">
        <button
          @click="switchTab('rides')"
          :class="activeTab === 'rides'
            ? 'bg-white text-slate-800 shadow-lg shadow-black/10'
            : 'bg-white/20 text-white hover:bg-white/30'"
          class="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all duration-300"
        >
          <!-- Car Icon -->
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 17h6" />
          <circle cx="17" cy="17" r="2" />
          </svg>
          Попутки
        </button>
        <button
          @click="switchTab('buses')"
          :class="activeTab === 'buses'
            ? 'bg-white text-slate-800 shadow-lg shadow-black/10'
            : 'bg-white/20 text-white hover:bg-white/30'"
          class="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all duration-300"
        >
          <!-- Bus Icon -->
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 11h18M7 19v2M17 19v2M3 8h18"/>
            <circle cx="7.5" cy="16" r="1" fill="currentColor"/>
            <circle cx="16.5" cy="16" r="1" fill="currentColor"/>
          </svg>
          Автобусы
        </button>
      </div>

      <h1 class="text-white text-2xl font-bold mb-5 relative z-10 tracking-tight">
        {{ activeTab === 'rides' ? 'Поиск попутки' : 'Билеты на автобус' }}
      </h1>

      <!-- Search form -->
      <div class="bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-lg shadow-black/5 space-y-4 relative z-10 ring-1 ring-black/5">
        <!-- From -->
        <div class="relative group">
          <div class="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-[3px] pointer-events-none z-10 transition-colors"
            :class="activeTab === 'rides' ? 'border-yellow-500 group-focus-within:bg-yellow-500' : 'border-blue-500 group-focus-within:bg-blue-500'"></div>
          <select v-model="fromCity" class="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl outline-none text-gray-800 font-medium appearance-none focus:bg-white transition-all border border-transparent cursor-pointer"
            :class="activeTab === 'rides' ? 'focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-200' : 'focus:ring-2 focus:ring-blue-500/50 focus:border-blue-200'">
            <option value="" disabled selected>Откуда</option>
            <option v-for="city in availableCities" :key="'from-'+city" :value="city">{{ city }}</option>
          </select>
          <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </div>
        </div>

        <!-- To -->
        <div class="relative group">
          <div class="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-[3px] border-gray-300 bg-transparent pointer-events-none z-10"></div>
          <select v-model="toCity" class="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl outline-none text-gray-800 font-medium appearance-none focus:bg-white transition-all border border-transparent cursor-pointer"
            :class="activeTab === 'rides' ? 'focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-200' : 'focus:ring-2 focus:ring-blue-500/50 focus:border-blue-200'">
            <option value="" disabled selected>Куда</option>
            <option v-for="city in availableCities" :key="'to-'+city" :value="city">{{ city }}</option>
          </select>
          <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </div>
        </div>

        <!-- Date -->
        <div class="relative">
          <input type="date" v-model="date" class="w-full pl-4 pr-4 py-3 bg-gray-50 rounded-xl text-gray-600 font-medium outline-none focus:bg-white transition-all border border-transparent focus:border-blue-200 appearance-none"/>
        </div>

        <button @click="search" class="w-full font-bold py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all hover:shadow-xl hover:-translate-y-0.5 mt-2 flex items-center justify-center space-x-2 text-white"
          :class="activeTab === 'rides' ? 'bg-slate-900 shadow-slate-900/30' : 'bg-blue-600 shadow-blue-500/30'">
          <span>{{ activeTab === 'rides' ? 'Найти попутку' : 'Найти билеты' }}</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Results section -->
    <div class="p-5 space-y-4 pb-32">

      <!-- Loading skeleton -->
      <div v-if="isLoading" class="space-y-4">
        <div v-for="i in 3" :key="i" class="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 animate-pulse h-48"></div>
      </div>

      <!-- ======== RIDES RESULTS ======== -->
      <template v-if="!isLoading && activeTab === 'rides'">
        <TransitionGroup name="list" tag="div" class="space-y-4">
          <template v-for="(ride, index) in rides" :key="`ride-${ride.id}`">
            <div @click="$router.push({ name: 'ride-details', params: { id: ride.id } })"
                 class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/50 hover:shadow-xl hover:shadow-yellow-500/10 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group"
                 :style="{ transitionDelay: `${index * 80}ms` }">
            <div class="flex justify-between items-start mb-4">
              <div>
                <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ ride.time }}</div>
                <div class="text-2xl font-bold text-slate-800 mt-1">{{ formatHumanDate(ride.date) }}</div>
              </div>
              <div v-if="!ride.is_passenger_entry" class="bg-green-50 px-3 py-1.5 rounded-xl border border-green-100 flex items-center space-x-1">
                <span class="text-xs font-bold text-green-400">от</span>
                <div class="text-lg font-bold text-green-600">{{ getMinRidePrice(ride) }} с.</div>
              </div>
            </div>

            <div class="relative pl-8 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-yellow-400 before:to-gray-200 before:rounded-full">
              <div class="relative">
                <div class="absolute -left-[29px] top-1.5 w-3.5 h-3.5 rounded-full border-[3px] border-yellow-500 bg-white ring-4 ring-white"></div>
                <div class="font-bold text-lg text-slate-700 leading-none">{{ ride.from_city }}</div>
              </div>
              <div class="relative">
                <div class="absolute -left-[29px] top-1.5 w-3.5 h-3.5 rounded-full border-[3px] border-gray-300 bg-white ring-4 ring-white"></div>
                <div class="font-bold text-lg text-slate-700 leading-none">{{ ride.to_city }}</div>
              </div>
            </div>

            <div class="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
              <div class="flex items-center space-x-3 cursor-pointer p-2 -ml-2 rounded-xl hover:bg-gray-50 transition-colors" @click.stop="$router.push(`/driver/${ride.driver_id}/reviews`)">
                <div class="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-slate-600 shadow-inner">
                  {{ ride.driver_name ? ride.driver_name[0] : 'D' }}
                </div>
                <div>
                  <div class="text-sm font-bold text-slate-700">
                    {{ ride.is_passenger_entry ? 'Ищет машину' : (ride.driver_name || 'Водитель') }}
                  </div>
                  <div class="flex items-center mt-0.5">
                    <span v-if="ride.is_passenger_entry" class="text-[10px] font-bold text-blue-500 uppercase tracking-tighter bg-blue-50 px-2 py-0.5 rounded-md">Пассажир</span>
                    <template v-else>
                      <svg class="w-3 h-3 text-yellow-400 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                      <span class="text-xs ml-1 text-slate-500 font-medium">{{ ride.driver_rating }}</span>
                    </template>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-1 text-xs text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                <span v-if="ride.is_passenger_entry">{{ ride.seats }} мест</span>
                <span v-else>{{ ride.seats - (ride.booked_seats || 0) }} из {{ ride.seats }} свободно</span>
              </div>
            </div>
            </div>

            <!-- Mobile App Promo Card after 3rd ride -->
            <div v-if="index === 2" class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/50 flex flex-col items-center justify-center text-center space-y-4"
                 :style="{ transitionDelay: `${(index + 1) * 80}ms` }">
              <div class="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="space-y-1">
                <h3 class="text-lg font-bold text-slate-800">Поездки в кармане</h3>
                <p class="text-sm text-slate-600">Скачайте приложение для удобного поиска и управления бронированиями</p>
              </div>
              <a href="https://github.com/Shomirsaidov/poputki-apk/raw/refs/heads/main/app-release.apk"
                 class="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-bold py-3 rounded-2xl shadow-lg shadow-amber-500/20 hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
                </svg>
                <span>Скачать для Android</span>
              </a>
            </div>
          </template>
        </TransitionGroup>

        <!-- Alternative Search Offer -->
        <Transition name="fade-slide">
          <div v-if="showAltOffer" class="mb-2">
            <div class="bg-white/80 backdrop-blur-xl rounded-3xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 group transition-all hover:shadow-md">
              <!-- Left accent bar -->
              <div class="absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full"
                :class="altOfferType === 'buses' ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]'"></div>
              
              <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-300"
                :class="altOfferType === 'buses' ? 'bg-blue-50 border-blue-100 text-blue-600 group-hover:bg-blue-100' : 'bg-amber-50 border-amber-100 text-amber-600 group-hover:bg-amber-100'">
                <svg v-if="altOfferType === 'buses'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h8m0 0a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2V9a2 2 0 012-2m0 0V5a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 17h6" />
          <circle cx="17" cy="17" r="2" />
                </svg>
              </div>
              
              <div class="flex-1 min-w-0">
                <h3 class="text-slate-800 font-extrabold text-sm leading-tight truncate">
                  {{ altOfferType === 'buses' ? 'Нашли рейсы автобусов' : 'Нашли частные попутки' }}
                </h3>
                <p class="text-slate-500 text-[11px] font-medium leading-tight mt-0.5">
                  {{ altOfferType === 'buses' ? 'По вашему маршруту есть билеты' : 'Посмотрите доступные предложения' }}
                </p>
              </div>

              <button @click="performAltSearch" class="group/btn relative shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm border-b-2"
                :class="altOfferType === 'buses'
                  ? 'bg-blue-600 text-white border-blue-800 hover:bg-blue-700'
                  : 'bg-amber-400 text-white border-amber-600 hover:bg-amber-500'">
                Смотреть
              </button>
            </div>
          </div>
        </Transition>

        <div v-if="rides.length === 0 && !showAltOffer" class="text-center mt-16">
          <div class="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
          <p class="text-gray-500 font-medium">Попуток пока нет</p>
          <p class="text-gray-400 text-sm mt-1">Попробуйте изменить дату или параметры</p>
        </div>
      </template>

      <!-- ======== BUS TICKETS RESULTS ======== -->
      <template v-if="!isLoading && activeTab === 'buses'">


        <TransitionGroup name="list" tag="div" class="space-y-4">
          <template v-for="(ticket, index) in busTickets" :key="`ticket-${ticket.id}`">
            <div @click="$router.push({ name: 'bus-ticket-details', params: { id: ticket.id } })"
                 class="bg-white rounded-3xl shadow-sm border border-gray-100/70 cursor-pointer hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                 :style="{ transitionDelay: `${index * 80}ms` }">

            <!-- Ticket card: reference image style -->
            <div class="p-5">
              <!-- Departure row -->
              <div class="flex items-start justify-between mb-1">
                <div>
                  <div class="text-xs text-gray-500 font-medium">{{ ticket.departure_time }}</div>
                  <div class="text-3xl font-bold text-slate-800 leading-none mt-0.5">{{ formatDate(ticket.departure_date) }}</div>
                  <div class="text-sm font-bold text-slate-700 mt-1">{{ ticket.from_city }}</div>
                  <div class="text-xs text-slate-500 mt-0.5">{{ ticket.from_address }}</div>
                </div>

                <!-- Duration arrow -->
                <div class="flex flex-col items-center gap-1 pt-4 px-2">
                  <div class="flex items-center gap-1 text-gray-300">
                    <div class="w-2 h-2 rounded-full bg-gray-300"></div>
                    <div class="w-12 h-[2px] bg-gray-200 relative">
                      <div class="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-gray-300 border-y-2 border-y-transparent"></div>
                      <!-- Dotted line overlay -->
                      <div class="absolute inset-0 border-t border-dashed border-gray-300"></div>
                    </div>
                  </div>
                </div>

                <!-- Arrival -->
                <div class="text-right">
                  <div class="text-xs text-gray-500 font-medium">{{ ticket.arrival_time }}</div>
                  <div class="text-3xl font-bold text-slate-800 leading-none mt-0.5">{{ formatDate(ticket.arrival_date) }}</div>
                  <div class="text-sm font-bold text-slate-700 mt-1 max-w-[120px] ml-auto">{{ ticket.to_city }}</div>
                  <div class="text-xs text-slate-500 mt-0.5 max-w-[120px] ml-auto">{{ ticket.to_address }}</div>
                </div>
              </div>

              <!-- Intermediate stop indicator if matched -->
              <div v-if="ticket.matchingStop" class="mt-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between animate-fade-in shadow-sm">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <div class="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] leading-none mb-1">Ваша остановка</div>
                    <div class="text-sm font-bold text-blue-700">{{ ticket.matchingStop.city }}</div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] leading-none mb-1">Время</div>
                  <div class="text-sm font-black text-blue-800">{{ ticket.matchingStop.time }}</div>
                </div>
              </div>

              <!-- Bus Info Badge (Phase E) -->
              <div v-if="ticket.bus" class="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h8m0 0a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2V9a2 2 0 012-2m0 0V5a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </div>
                  <div class="min-w-0 truncate">
                    <div class="font-bold text-slate-800 truncate">{{ ticket.bus.brand }} {{ ticket.bus.model }}</div>
                    <div class="text-[11px] text-slate-500 font-medium">
                      {{ ticket.bus.bus_type === 'double' ? 'Двухэтажный' : 'Одноэтажный' }} • {{ ticket.bus.total_seats }} мест
                    </div>
                  </div>
                </div>

                <!-- Top amenities preview -->
                <div v-if="ticket.bus.amenities && ticket.bus.amenities.length > 0" class="hidden sm:flex items-center gap-1.5 shrink-0">
                  <span v-for="amenity in ticket.bus.amenities.slice(0, 3)" :key="amenity"
                        class="bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-slate-600">
                    {{ amenityLabels[amenity] || amenity }}
                  </span>
                  <span v-if="ticket.bus.amenities.length > 3" class="text-[10px] text-gray-400 font-medium">
                    +{{ ticket.bus.amenities.length - 3 }}
                  </span>
                </div>
              </div>

              <!-- Divider -->
              <div class="border-t border-dashed border-gray-100 my-4"></div>

              <!-- Bottom row: duration/company + price -->
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-slate-600 font-semibold text-sm">{{ formattedDurationFn(ticket.duration_minutes) }}</div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs text-gray-400">{{ ticket.transport_company }}</span>
                    <span v-if="ticket.bus_type === 'double'" class="bg-blue-50 text-blue-600 text-[9px] font-black px-1.5 py-0.5 rounded-md border border-blue-100 uppercase tracking-tighter shrink-0">
                      2 этажа
                    </span>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-2xl font-bold text-slate-800">{{ ticket.price }} <span class="text-base font-semibold text-gray-500">с.</span></div>
                  <div class="text-xs text-gray-400">за 1 пассажира</div>
                </div>
              </div>
            </div>
            </div>

            <!-- Mobile App Promo Card after 3rd bus ticket -->
            <div v-if="index === 2" class="bg-white rounded-3xl shadow-sm border border-gray-100/70 flex flex-col items-center justify-center text-center space-y-4 p-6"
                 :style="{ transitionDelay: `${(index + 1) * 80}ms` }">
              <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="space-y-1">
                <h3 class="text-lg font-bold text-slate-800">Поездки в кармане</h3>
                <p class="text-sm text-slate-600">Скачайте приложение для удобного поиска и управления бронированиями</p>
              </div>
              <a href="https://github.com/Shomirsaidov/poputki-apk/raw/refs/heads/main/app-release.apk"
                 class="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold py-3 rounded-2xl shadow-lg shadow-blue-500/20 hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
                </svg>
                <span>Скачать для Android</span>
              </a>
            </div>
          </template>
        </TransitionGroup>

        <!-- Alternative Search Offer -->
        <Transition name="fade-slide">
          <div v-if="showAltOffer" class="mb-2">
            <div class="bg-white/80 backdrop-blur-xl rounded-3xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 group transition-all hover:shadow-md">
              <!-- Left accent bar -->
              <div class="absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full"
                :class="altOfferType === 'buses' ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]'"></div>
              
              <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-300"
                :class="altOfferType === 'buses' ? 'bg-blue-50 border-blue-100 text-blue-600 group-hover:bg-blue-100' : 'bg-amber-50 border-amber-100 text-amber-600 group-hover:bg-amber-100'">
                <svg v-if="altOfferType === 'buses'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h8m0 0a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2V9a2 2 0 012-2m0 0V5a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 17h6" />
          <circle cx="17" cy="17" r="2" />
                </svg>
              </div>
              
              <div class="flex-1 min-w-0">
                <h3 class="text-slate-800 font-extrabold text-sm leading-tight truncate">
                  {{ altOfferType === 'buses' ? 'Нашли рейсы автобусов' : 'Нашли частные поездки' }}
                </h3>
                <p class="text-slate-500 text-[11px] font-medium leading-tight mt-0.5">
                  {{ altOfferType === 'buses' ? 'По вашему маршруту есть билеты' : 'Посмотрите доступные предложения' }}
                </p>
              </div>

              <button @click="performAltSearch" class="group/btn relative shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm border-b-2"
                :class="altOfferType === 'buses'
                  ? 'bg-blue-600 text-white border-blue-800 hover:bg-blue-700'
                  : 'bg-amber-400 text-white border-amber-600 hover:bg-amber-500'">
                Смотреть
              </button>
            </div>
          </div>
        </Transition>

        <div v-if="busTickets.length === 0 && !showAltOffer" class="text-center mt-16">
          <div class="inline-flex items-center justify-center w-20 h-20 bg-blue-50 rounded-full mb-4">
            <svg class="h-10 w-10 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="5" width="18" height="14" rx="2"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 11h18M7 19v2M17 19v2M3 8h18"/>
            </svg>
          </div>
          <p class="text-gray-500 font-medium">Рейсов пока нет</p>
          <p class="text-gray-400 text-sm mt-1">Попробуйте изменить параметры поиска</p>
        </div>
      </template>
    </div>
  </div>
</template>



<style scoped>
.list-enter-active, .list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from, .list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-slide-enter-active, .fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-slide-enter-from, .fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.98);
}
.animate-fade-in {
  animation: fadeIn 0.4s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
