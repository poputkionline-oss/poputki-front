<script>
import api from '../api';
import { getTelegramUser, getTelegramInitData } from '../telegram';
import AppLogo from '../components/AppLogo.vue';
import acquisitionService from '../services/acquisitionService';

export default {
    name: 'LandingView',
    components: {
        AppLogo
    },
  data() {
    return {
      fromCity: '',
      toCity: '',
      date: '',
      availableCities: [],
      activeTab: 'rides',
      recentRides: []
    };
  },
  methods: {
    async fetchCities() {
      try {
        const type = this.activeTab === 'buses' ? 'bus' : 'ride';
        const res = await api.get('/general/cities', { params: { type } });
        this.availableCities = res.data;
      } catch (err) {
        console.error('Failed to fetch cities:', err);
      }
    },
    async fetchRecentRides() {
      try {
        const res = await api.get('/rides');
        // Get the top 4 most recent rides
        this.recentRides = res.data.slice(0, 4);
      } catch (err) {
        console.error('Failed to fetch recent rides:', err);
      }
    },
    goToSearch() {
      if (this.fromCity && this.toCity) {
        acquisitionService.trackRouteSearched({
          from_city_id: this.fromCity,
          to_city_id: this.toCity,
          travel_date: this.date
        });
      }
      this.$router.push({
        path: '/search',
        query: {
          from: this.fromCity || undefined,
          to: this.toCity || undefined,
          date: this.date || undefined,
          tab: this.activeTab === 'buses' ? 'bus' : 'rides'
        }
      });
    },
    async openTelegramBot() {
      await acquisitionService.openTelegramBot();
    },
    async syncTelegram() {
      const tgUser = getTelegramUser();
      console.log("LandingView: syncTelegram triggered. tgUser:", tgUser);
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
        console.log("LandingView: sending sync payload:", payload);
        const res = await api.post('/auth/telegram-login', payload);
        console.log("LandingView: sync response:", res.data);

        if (res.data.user) {
          localStorage.setItem('user', JSON.stringify(res.data.user));
          if (res.data.token) localStorage.setItem('token', res.data.token);
        }
      } catch (e) {
        console.error("LandingView: Sync TG error:", e);
      }
    }
  },
  mounted() {
    acquisitionService.initSession();
    this.fetchCities();
    this.fetchRecentRides();
    this.syncTelegram();
  },
  watch: {
    activeTab() {
      this.fetchCities();
      // Reset selected cities if needed, or keep them if they exist in both lists
      // this.fromCity = '';
      // this.toCity = '';
    }
  }
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-amber-200 overflow-x-hidden">
    
    <!-- Hero Section -->
    <div class="relative bg-white pt-6 pb-20 md:pt-16 md:pb-32 overflow-hidden border-b border-gray-100 shadow-sm shadow-blue-900/5">
        
        <!-- Decoration Elements -->
        <div class="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-amber-400/10 rounded-full blur-[80px] pointer-events-none"></div>
        <div class="absolute bottom-0 left-0 -ml-32 -mb-32 w-80 h-80 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>

        <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
            <!-- Navigation -->
            <nav class="flex items-center justify-between mb-16 md:mb-24 gap-4">
                <AppLogo @click="$router.push('/')" class="cursor-pointer shrink-0" />
                <div class="flex items-center gap-3 flex-wrap justify-end">
                    <button @click="$router.push('/create')" class="text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors hidden md:block">
                        Создать попутку
                    </button>
                    <a
                        href="https://github.com/Shomirsaidov/poputki-apk/raw/refs/heads/main/app-release.apk"
                        class="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors hidden md:block bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg border border-blue-200"
                    >
                        Приложение
                    </a>
                    <button @click="$router.push('/search')" class="text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg transition-all shadow-md shadow-blue-600/20 active:scale-95">
                        Найти попутку
                    </button>
                </div>
            </nav>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
                <!-- Hero Text -->
                <div class="lg:col-span-5 text-center lg:text-left space-y-6 lg:pr-8">
                    <div class="inline-flex items-center space-x-2 bg-amber-50 border border-amber-200/50 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide mb-2 text-amber-600">
                        №1 Сервис совместных поездок
                    </div>
                    <h1 class="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                        Попути —<br class="hidden lg:block"/> 
                        <span class="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">
                            дешевле
                        </span> 
                        и быстрее
                    </h1>
                    <p class="text-lg text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto lg:mx-0">
                        Экономьте на межгороде. Надежные водители, комфортные автобусы и попутчики в Таджикистане и по всей Средней Азии.
                    </p>
                </div>

                <!-- Search Widget -->
                <div class="lg:col-span-7">
                    <div class="bg-white rounded-[32px] p-2 md:p-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-gray-100 max-w-3xl mx-auto lg:mx-0 lg:ml-auto">
                        
                        <!-- Tab Switcher -->
                        <div class="flex gap-2 p-2 bg-slate-50 border border-slate-100 rounded-[24px] mb-3">
                            <button @click="activeTab = 'rides'" 
                                :class="activeTab === 'rides' ? 'bg-white text-slate-900 shadow-md shadow-gray-200/50 border-gray-100/50' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 border-transparent'"
                                class="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm md:text-[15px] transition-all duration-300 border">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 17h6" />
          <circle cx="17" cy="17" r="2" />
                                </svg>
                                Попутки
                            </button>
                            <button @click="activeTab = 'buses'" 
                                :class="activeTab === 'buses' ? 'bg-white text-slate-900 shadow-md shadow-gray-200/50 border-gray-100/50' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 border-transparent'"
                                class="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm md:text-[15px] transition-all duration-300 border">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="5" width="18" height="14" rx="2"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 11h18M7 19v2M17 19v2M3 8h18"/>
                                    <circle cx="7.5" cy="16" r="1" fill="currentColor"/>
                                    <circle cx="16.5" cy="16" r="1" fill="currentColor"/>
                                </svg>
                                Автобусные рейсы
                            </button>
                        </div>

                        <!-- Search Fields Stack/Grid -->
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-3 p-1">
                            
                            <!-- From -->
                            <div class="relative group md:col-span-1 border border-transparent rounded-[20px] focus-within:border-amber-200/50">
                                <div class="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                                    <div class="w-3 h-3 rounded-full border-[3px]" :class="activeTab === 'rides' ? 'border-amber-400' : 'border-blue-400'"></div>
                                </div>
                                <select v-model="fromCity" class="w-full h-[60px] pl-11 pr-4 bg-slate-50 rounded-[20px] outline-none text-slate-800 font-bold appearance-none transition-all focus:bg-white cursor-pointer hover:bg-slate-100">
                                    <option value="" disabled selected class="font-normal">Откуда?</option>
                                    <option v-for="city in availableCities" :key="'from-'+city" :value="city">{{ city }}</option>
                                </select>
                                <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                                </div>
                            </div>

                            <!-- To -->
                            <div class="relative group md:col-span-1 border border-transparent rounded-[20px] focus-within:border-slate-300/50">
                                <div class="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                                    <div class="w-3 h-3 rounded-full border-[3px] border-slate-300"></div>
                                </div>
                                <select v-model="toCity" class="w-full h-[60px] pl-11 pr-4 bg-slate-50 rounded-[20px] outline-none text-slate-800 font-bold appearance-none transition-all focus:bg-white cursor-pointer hover:bg-slate-100">
                                    <option value="" disabled selected class="font-normal">Куда?</option>
                                    <option v-for="city in availableCities" :key="'to-'+city" :value="city">{{ city }}</option>
                                </select>
                                <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                                </div>
                            </div>

                            <!-- Date -->
                            <div class="relative group md:col-span-1 border border-transparent rounded-[20px] focus-within:border-slate-300/50">
                                <input type="date" v-model="date" class="w-full h-[60px] px-5 bg-slate-50 rounded-[20px] outline-none text-slate-800 font-bold appearance-none transition-all focus:bg-white cursor-pointer hover:bg-slate-100 text-sm" />
                            </div>

                            <!-- Search CTA -->
                            <div class="md:col-span-1">
                                <button @click="goToSearch" class="h-[60px] w-full rounded-[20px] font-bold text-base md:text-lg text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2">
                                    <span>Найти</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- How it works -->
    <div class="py-20 md:py-24 bg-slate-50">
        <div class="container mx-auto px-4 max-w-6xl">
            <div class="text-center mb-16">
                <h2 class="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Как это работает?</h2>
                <p class="text-slate-500 mt-3 font-medium text-lg">Три простых шага к вашей следующей поездке</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                <!-- Connector Line (Desktop only) -->
                <div class="hidden md:block absolute top-[45px] left-[15%] right-[15%] h-[2px] border-t-2 border-dashed border-slate-200 z-0"></div>

                <div class="relative z-10 flex flex-col items-center text-center p-6 bg-white rounded-3xl shadow-sm border border-gray-100/50">
                    <div class="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-6 border-8 border-white shadow-sm">
                        <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <h3 class="text-xl font-bold text-slate-900 mb-2">Найдите маршрут</h3>
                    <p class="text-slate-500">Укажите откуда, куда и когда вы хотите поехать.</p>
                </div>

                <div class="relative z-10 flex flex-col items-center text-center p-6 bg-white rounded-3xl shadow-sm border border-gray-100/50">
                    <div class="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-6 border-8 border-white shadow-sm">
                        <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <h3 class="text-xl font-bold text-slate-900 mb-2">Забронируйте место</h3>
                    <p class="text-slate-500">Выберите водителя или автобус и зарезервируйте.</p>
                </div>

                <div class="relative z-10 flex flex-col items-center text-center p-6 bg-white rounded-3xl shadow-sm border border-gray-100/50">
                    <div class="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-6 border-8 border-white shadow-sm">
                        <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 class="text-xl font-bold text-slate-900 mb-2">Наслаждайтесь поездкой</h3>
                    <p class="text-slate-500">Оплачивайте напрямую водителю и экономьте.</p>
                </div>
            </div>
        </div>
    </div>

    <!-- For Drivers Premium Glassmorphic Block -->
    <div class="py-24 bg-amber-50 relative overflow-hidden border-y border-amber-100/50">
        <!-- Abstract glowing background elements -->
        <div class="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-300/30 rounded-full blur-[100px] pointer-events-none transform translate-x-1/3 -translate-y-1/3"></div>
        <div class="absolute bottom-0 left-0 w-[400px] h-[400px] bg-orange-400/20 rounded-full blur-[100px] pointer-events-none transform -translate-x-1/2 translate-y-1/2"></div>
        
        <div class="container mx-auto px-4 max-w-6xl relative z-10">
            <div class="bg-white/70 backdrop-blur-xl border border-white rounded-[40px] p-8 md:p-14 shadow-2xl shadow-amber-900/5 overflow-hidden">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative">
                    <!-- Left side text and CTA -->
                    <div class="space-y-8">
                        <div class="inline-flex items-center space-x-2 bg-amber-100 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase text-amber-600 border border-amber-200/50">
                            Для водителей
                        </div>
                        <h2 class="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                            Окупайте расходы<br class="hidden md:block"/> на бензин
                        </h2>
                        <p class="text-lg text-slate-600 leading-relaxed font-medium max-w-md">
                            Возьмите попутчиков, если вам по пути. Удобный интерфейс, безопасные профили пассажиров и полная свобода выбора расценок.
                        </p>
                        
                        <div class="pt-4">
                            <button @click="$router.push('/create')" class="group relative px-8 py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-2xl text-lg flex items-center gap-3 overflow-hidden shadow-lg shadow-amber-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/40 active:scale-95">
                                <span class="relative z-10">Стать водителем</span>
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 relative z-10 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                                <!-- Button shine effect -->
                                <div class="absolute inset-0 bg-white/20 translate-x-[-100%] skew-x-[-15deg] group-hover:animate-[shine_1.5s_ease-out_infinite]"></div>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Right side visual representation -->
                    <div class="relative hidden md:flex justify-center flex-col gap-4 pl-12">
                        <!-- Card 1 -->
                        <div class="bg-white backdrop-blur-md border border-gray-100 rounded-3xl p-6 flex items-center gap-5 shadow-xl shadow-gray-200/50 transform translate-x-12 hover:-translate-y-1 transition-transform cursor-default">
                             <div class="w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-500 rounded-[18px] flex items-center justify-center text-white shrink-0 shadow-lg shadow-green-500/30">
                                 <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                             </div>
                             <div>
                                 <div class="text-slate-900 font-bold text-xl mb-1">До +300 с. за рейс</div>
                                 <div class="text-slate-500 text-sm font-medium">Снижение расходов на авто</div>
                             </div>
                        </div>
                        
                        <!-- Card 2 -->
                        <div class="bg-white backdrop-blur-md border border-gray-100 rounded-3xl p-6 flex items-center gap-5 shadow-xl shadow-gray-200/50 transform -translate-x-4 hover:-translate-y-1 transition-transform cursor-default relative z-10">
                            <div class="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-[18px] flex items-center justify-center text-white shrink-0 shadow-lg shadow-amber-500/30">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                            <div>
                                <div class="text-slate-900 font-bold text-xl mb-1">Надежные люди</div>
                                <div class="text-slate-500 text-sm font-medium">Рейтинги и отзывы пассажиров</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Recent Rides Sections -->
    <div class="py-20 md:py-24 bg-white border-y border-gray-100">
        <div class="container mx-auto px-4 max-w-6xl">
            <div class="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
               <div>
                   <h2 class="text-3xl font-extrabold text-slate-900 tracking-tight">Свежие поездки</h2>
                   <p class="text-slate-500 font-medium mt-1">Только что опубликованные маршруты от наших водителей</p>
               </div>
               <button @click="$router.push('/search')" class="text-blue-600 font-bold hover:text-blue-700 transition-colors flex items-center gap-1">
                   Все поездки <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
               </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div v-for="ride in recentRides" :key="ride.id" @click="$router.push({ name: 'ride-details', params: { id: ride.id } })"
                    class="group cursor-pointer bg-slate-50 hover:bg-white rounded-2xl p-5 border border-transparent hover:border-gray-200 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] active:scale-95 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-8">
                            <div>
                                <div class="text-lg font-bold text-slate-900 leading-tight">{{ ride.from_city }}</div>
                                <div class="text-sm font-semibold text-slate-500 mt-0.5">{{ ride.to_city }}</div>
                            </div>
                            <div class="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-blue-500 group-hover:bg-blue-50 transition-colors shrink-0 ml-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center justify-between text-sm mt-auto">
                        <span class="text-slate-500 font-medium">{{ ride.date }}</span>
                        <span class="font-bold text-lg text-slate-800">{{ ride.price }} с.</span>
                    </div>
                </div>
            </div>
            
            <div v-if="recentRides.length === 0" class="text-center py-8 text-slate-500">
                Загрузка поездок...
            </div>
        </div>
    </div>

    <!-- Trust / Safety -->
    <div class="py-20 md:py-24 bg-slate-50">
        <div class="container mx-auto px-4 max-w-4xl text-center">
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                <div class="bg-white p-8 rounded-3xl shadow-sm border border-gray-100/50 text-left">
                    <div class="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 mb-5">
                       <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <h3 class="text-xl font-bold text-slate-900 mb-2">Безопасность прежде всего</h3>
                    <p class="text-slate-500 leading-relaxed">Система рейтингов и верифицированные номера телефонов всех участников обеспечат вам безопасность в дороге.</p>
                </div>
                
                <div class="bg-white p-8 rounded-3xl shadow-sm border border-gray-100/50 text-left flex flex-col items-start">
                     <div class="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 mb-5 shrink-0">
                       <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <h3 class="text-xl font-bold text-slate-900 mb-2">Telegram интеграция</h3>
                    <p class="text-slate-500 leading-relaxed mb-6">Получайте все уведомления о бронированиях напрямую в Telegram. Быстро, удобно и всегда под рукой.</p>
                    
                    <button @click="openTelegramBot" class="mt-auto group inline-flex items-center gap-2 text-blue-600 font-bold bg-blue-50 px-5 py-3 rounded-2xl hover:bg-blue-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.96-.64-.34-.99.23-1.58.15-.15 2.76-2.52 2.81-2.74.01-.03.01-.13-.06-.18-.08-.05-.18-.03-.25-.01-.11.02-1.87 1.18-5.28 3.48-.5.35-.95.52-1.36.51-.45-.01-1.31-.25-1.95-.46-.78-.25-1.4-.38-1.35-.8.03-.22.34-.45.92-.69 3.63-1.58 6.05-2.63 7.27-3.13 3.46-1.43 4.18-1.68 4.65-1.69.11 0 .34.02.48.13.12.09.15.22.16.32-.01.07-.01.16-.02.26z"/></svg>
                        Перейти в Telegram-бот
                    </button>
                </div>
            </div>

            <h2 class="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">Готовы в путь?</h2>
            <p class="text-slate-600 text-lg mb-10 max-w-2xl mx-auto font-medium">Выбирайте удобный способ поиска поездок — веб или мобильное приложение. На обе платформы нужна одна учетная запись.</p>
            <div class="flex items-center justify-center gap-4">
                <button @click="$router.push('/search')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-base md:text-lg px-8 py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95">
                    Поиск на сайте
                </button>
                <a href="https://github.com/Shomirsaidov/poputki-apk/raw/refs/heads/main/app-release.apk" class="hidden md:block bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg px-8 py-4 rounded-xl border border-slate-200 transition-all active:scale-95">
                    Скачать приложение
                </a>
            </div>
        </div>
    </div>

    <!-- Mobile App Download Section -->
    <div class="py-16 md:py-20 bg-gradient-to-b from-blue-50 to-white relative overflow-hidden border-y border-blue-100/50">
        <div class="container mx-auto px-4 max-w-5xl">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <!-- Left: Text and CTA -->
                <div class="space-y-6">
                    <!-- Badge -->
                    <div class="inline-flex items-center space-x-2 bg-blue-100 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase text-blue-600 border border-blue-200/50">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                        </svg>
                        Android приложение
                    </div>

                    <!-- Heading -->
                    <div class="space-y-3">
                        <h2 class="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                            Поездки в кармане
                        </h2>
                        <p class="text-lg text-slate-600 font-medium leading-relaxed max-w-lg">
                            Загрузите приложение для быстрого поиска, управления бронированиями и уведомлений о новых рейсах в реальном времени.
                        </p>
                    </div>

                    <!-- Features List -->
                    <div class="space-y-3 pt-2">
                        <div class="flex items-start gap-3">
                            <div class="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            </div>
                            <p class="text-sm font-medium text-slate-700">Мгновенный поиск рейсов по дате и маршруту</p>
                        </div>
                        <div class="flex items-start gap-3">
                            <div class="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            </div>
                            <p class="text-sm font-medium text-slate-700">Управление бронированиями в одном месте</p>
                        </div>
                        <div class="flex items-start gap-3">
                            <div class="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            </div>
                            <p class="text-sm font-medium text-slate-700">Уведомления о новых попутках и изменениях</p>
                        </div>
                    </div>

                    <!-- Download Button -->
                    <div class="pt-4">
                        <a
                            href="https://github.com/Shomirsaidov/poputki-apk/raw/refs/heads/main/app-release.apk"
                            class="inline-block px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-xl hover:bg-blue-700 transition-all active:scale-95"
                        >
                            Скачать для Android
                        </a>
                    </div>
                </div>

                <!-- Right: Visual Mockup -->
                <div class="hidden md:flex justify-center relative">
                    <div class="relative w-full max-w-sm">
                        <!-- Glow effect -->
                        <div class="absolute -inset-4 bg-gradient-to-br from-blue-200 to-blue-100 rounded-[40px] opacity-30 blur-xl"></div>

                        <!-- Phone frame -->
                        <div class="relative bg-white rounded-[40px] border-8 border-slate-900 shadow-2xl overflow-hidden aspect-[9/19.5]">
                            <!-- Notch -->
                            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-slate-900 rounded-b-3xl z-20"></div>

                            <!-- Screen content -->
                            <div class="h-full bg-gradient-to-b from-blue-50 to-white p-6 pt-10 flex flex-col gap-4">
                                <!-- Header -->
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-[10px] font-bold text-slate-700">9:41</span>
                                    <div class="flex gap-1">
                                        <div class="w-1 h-1.5 bg-slate-900 rounded-sm"></div>
                                        <div class="w-1 h-1.5 bg-slate-900 rounded-sm"></div>
                                        <div class="w-1.5 h-1.5 bg-slate-900 rounded-sm"></div>
                                    </div>
                                </div>

                                <!-- App demo -->
                                <div class="space-y-3 text-center">
                                    <div class="w-8 h-8 rounded-full bg-blue-600 mx-auto"></div>
                                    <div>
                                        <p class="text-xs font-bold text-slate-800">Душанбе → Худжанд</p>
                                        <p class="text-[10px] text-slate-500">25 май, 10:00</p>
                                    </div>
                                </div>

                                <!-- Cards -->
                                <div class="space-y-2 mt-4">
                                    <div class="bg-white border border-slate-200 rounded-2xl p-3">
                                        <p class="text-[10px] font-bold text-slate-700">150 сом</p>
                                        <p class="text-[8px] text-slate-500 mt-1">2 свободных места</p>
                                    </div>
                                    <div class="bg-white border border-slate-200 rounded-2xl p-3">
                                        <p class="text-[10px] font-bold text-slate-700">120 сом</p>
                                        <p class="text-[8px] text-slate-500 mt-1">5 свободных мест</p>
                                    </div>
                                </div>

                                <!-- Bottom CTA -->
                                <div class="mt-auto pt-2">
                                    <button class="w-full bg-blue-600 text-white text-[10px] font-bold py-2 rounded-xl">
                                        Найти рейс
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Simple Footer -->
    <footer class="bg-white border-t border-gray-100 py-8 text-center text-slate-400 text-sm">
        <p>&copy; 2026 Poputki.online. Все права защищены.</p>
    </footer>

  </div>
</template>

<style scoped>
/* Fallback for the date input picker icon */
input[type="date"]::-webkit-calendar-picker-indicator {
    opacity: 0.5;
    cursor: pointer;
}
input[type="date"]::-webkit-calendar-picker-indicator:hover {
    opacity: 1;
}
</style>
